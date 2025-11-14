import Show from "../models/Show.js"
import Booking from "../models/Booking.js";
import stripe from 'stripe'
import { inngest } from "../inngest/index.js";

// Khởi tạo Stripe instance một lần ở đầu file
const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

// Function to check availability of selected seats for a movie
const checkSeatsAvailability = async (showId, selectedSeats)=>{
    try {
        const showData = await Show.findById(showId)
        if(!showData) return false;

        const occupiedSeats = showData.occupiedSeats;

        const isAnySeatTaken = selectedSeats.some(seat => occupiedSeats[seat]);

        return !isAnySeatTaken;
    } catch (error) {
        console.log(error.message);
            return false;
    }
}

export const createBooking = async (req, res) => {
    try {
        const {userId} = req.auth();
        const {showId, selectedSeats} = req.body;
        const {origin} = req.headers;

        //Check if the seat is available for the selected show
        const isAvailable = await checkSeatsAvailability(showId, selectedSeats)

        if(!isAvailable){
            return res.json({success: false, message: "Selected Seats are not available"})
        }

        // Get the show details
        const showData = await Show.findById(showId).populate('movie');

        // Create a new booking
        const booking = await Booking.create({
            user: userId,
            show: showId,
            bookedSeats: selectedSeats,
            amount: selectedSeats.length * showData.showPrice
        })

        selectedSeats.map((seat)=>{
            showData.occupiedSeats[seat] = userId;
        })

        showData.markModified('occupiedSeats');
        await showData.save();

        // (Stripe instance đã được khởi tạo ở đầu file)

        // Creating line items to for Stripe
        const line_items = [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: showData.movie.title
                },
                unit_amount: Math.floor(booking.amount) * 100
            },
            quantity: 1
        }]

        const session = await stripeInstance.checkout.sessions.create({
            success_url: `${origin}/loading/my-bookings`,
            cancel_url: `${origin}/my-bookings`,
            line_items: line_items,
            mode: 'payment',
            metadata: {
                bookingId: booking._id.toString()
            },
            expires_at: Math.floor(Date.now() / 1000) + 30 * 60 // Expires in 30 minutes
        })

        booking.paymentLink = session.url
        await booking.save()

        // Run Inngest Sheduler Function to check payment status after 10 minutes
        await inngest.send({
            name: "app/checkpayment",
            data: {
                bookingId: booking._id.toString()
            }
        })

        res.json({success: true, url: session.url})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

export const getOccupiedSeats = async (req, res)=>{
    try {

        const {showId} = req.params;
        const showData = await Show.findById(showId);

        const occupiedSeats = Object.keys(showData.occupiedSeats);

        res.json({success: true, occupiedSeats})

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})    }
}


// HÀM MỚI (ĐÃ SỬA LỖI): Kiểm tra trạng thái thanh toán của một booking
export const checkBookingStatus = async (req, res) => {
    let booking; // Khai báo booking ở phạm vi ngoài
    try {
        const { bookingId } = req.body;
        
        // Populate show và movie ngay từ đầu
        booking = await Booking.findById(bookingId).populate({
            path: "show",
            populate: { path: "movie" }
        });

        if (!booking) {
            return res.json({ success: false, message: "Booking not found" });
        }
        
        // Nếu đã thanh toán trong DB, trả về
        if (booking.isPaid) {
            return res.json({ success: true, booking });
        }

        // Nếu chưa thanh toán, kiểm tra với Stripe
        if (booking.paymentLink) {
            // Trích xuất session ID từ URL
            const sessionId = booking.paymentLink.split('/').pop();

            if (!sessionId || !sessionId.startsWith('cs_')) {
                 // Nếu link không hợp lệ, trả về booking gốc (đã populate)
                return res.json({ success: true, booking });
            }

            const session = await stripeInstance.checkout.sessions.retrieve(sessionId);

            // Nếu thanh toán thành công ("complete") VÀ đã trả tiền ("paid")
            if (session.status === 'complete' && session.payment_status === 'paid') {
                // Cập nhật database
                booking.isPaid = true;
                booking.paymentLink = ""; // Xóa link đi
                await booking.save();
                
                // Gửi email xác nhận (vì webhook đã không chạy)
                await inngest.send({
                    name: "app/show.booked",
                    data: { bookingId: booking._id.toString() }
                });
                
                // Trả về booking đã cập nhật (vẫn giữ thông tin populate)
                return res.json({ success: true, booking });
            }
        }
        
        // Nếu không có gì thay đổi, trả về booking gốc (đã populate)
        res.json({ success: true, booking });

    } catch (error) {
        console.log(error.message);
        // NẾU LỖI (VÍ DỤ: SESSION HẾT HẠN NHƯ TRONG ẢNH)
        // Đây là logic quan trọng bị thiếu:
        if (booking && !booking.isPaid) {
            // Xóa link thanh toán đi vì nó đã hết hạn/không hợp lệ
            booking.paymentLink = ""; 
            await booking.save();
        }
        // Trả về booking (đã populate) với link đã bị xóa
        // Nút "Pay Now" sẽ biến mất vì paymentLink đã bị xóa
        res.json({ success: true, booking: booking });
    }
}