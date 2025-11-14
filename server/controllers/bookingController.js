import Show from "../models/Show.js"
import Booking from "../models/Booking.js";
import stripe from 'stripe'
import { inngest } from "../inngest/index.js";

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

        // Stripe Gateway Initialize
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY)

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

        // Sửa lỗi: Lưu cả session.url và session.id
        booking.paymentLink = session.url; // Link cho người dùng nhấp
        booking.sessionId = session.id;   // ID cho server kiểm tra
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


export const checkBookingStatus = async (req, res) => {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);

    // Nếu không có vé, hoặc vé không có sessionId (vé cũ) hoặc đã thanh toán, chỉ cần trả về
    if (!booking || !booking.sessionId || booking.isPaid) {
        return res.json({ success: true, booking });
    }

    try {
        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
        // Sửa lỗi: Dùng booking.sessionId (thay vì link) để kiểm tra
        const session = await stripeInstance.checkout.sessions.retrieve(
            booking.sessionId 
        );

        if (session.status === 'complete' && session.payment_status === 'paid') {
            booking.isPaid = true;
            booking.paymentLink = undefined; // Xóa link
            booking.sessionId = undefined;   // Xóa ID
        } else if (session.status === 'expired') {
            // Link đã hết hạn, xóa đi để không hiển thị "Pay Now" nữa
            booking.paymentLink = undefined;
            booking.sessionId = undefined;
        }
        // QUAN TRỌNG: Nếu status là 'open', không làm gì cả.
        // Cứ để nguyên paymentLink và sessionId để người dùng có thể nhấp "Pay Now".

        await booking.save();
        res.json({ success: true, booking });

    } catch (error) {
        // Lỗi (ví dụ: session không tồn tại), cũng xóa link đi
        console.error("Lỗi khi kiểm tra session Stripe:", error.message);
        booking.paymentLink = undefined;
        booking.sessionId = undefined;
        await booking.save();
        res.json({ success: true, booking }); // Trả về vé đã được cập nhật
    }
}