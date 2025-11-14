import stripe from "stripe";
import Booking from "../models/Booking.js";
import { inngest } from "../inngest/index.js";

export const stripeWebhooks = async (request, response)=>{
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const sig = request.headers["stripe-signature"];

    let event;

    try {
        // Log body và signature để debug (nếu cần)
        // console.log("Received Stripe webhook body:", request.body);
        // console.log("Received Stripe signature:", sig);
        
        event = stripeInstance.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (error) {
        console.error("Webhook signature verification failed.", error.message);
        return response.status(400).send( `Webhook Error: ${error.message}` );
    }

    try {
        // Thay đổi sự kiện lắng nghe
        // Chuyển từ 'payment_intent.succeeded' sang 'checkout.session.completed'
        // 'checkout.session.completed' đáng tin cậy hơn để lấy metadata
        switch (event.type) {
            case "checkout.session.completed": { // <-- ĐÃ THAY ĐỔI
                const session = event.data.object; // session chính là event.data.object

                // Kiểm tra xem thanh toán đã thành công chưa
                if (session.payment_status === "paid") {
                    const {bookingId} = session.metadata;

                    // Nếu không tìm thấy bookingId trong metadata, báo lỗi
                    if (!bookingId) {
                        console.error("Webhook Error: Missing bookingId in session metadata.", session.id);
                        // Trả về 200 để Stripe không gửi lại, nhưng log lỗi
                        return response.status(200).json({ received: true, error: "Missing metadata" });
                    }

                    const updatedBooking = await Booking.findByIdAndUpdate(bookingId, {
                        isPaid: true,
                        paymentLink: "" // Xóa link thanh toán
                    });

                    if (!updatedBooking) {
                         console.error("Webhook Error: Booking not found with ID:", bookingId);
                         return response.status(404).send("Booking not found");
                    }

                    // Gửi email xác nhận
                    await inngest.send({
                        name: "app/show.booked",
                        data: {bookingId}
                    })
                }
                
                break;
            }    
        
            default:
                console.log('Unhandled event type', event.type)
        }
        
        response.json({received: true})

    } catch (err) {
        console.error("Webhook processing error:", err);
        response.status(500).send("Internal Server Error");
    }
}