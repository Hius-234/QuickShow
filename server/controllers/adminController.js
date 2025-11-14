import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import User from "../models/User.js";
import Movie from "../models/Movie.js"; // Import Movie model

// API to check if user is admin
export const isAdmin = async (req, res) => {
    res.json({success: true, isAdmin: true})
}

// API to get dashboard data
export const getDashboardData = async (req, res) => {
    try {
        const bookings = await Booking.find({isPaid: true});
        const activeShows = await Show.find({showDateTime: {$gte: new Date()}}).populate('movie');

        const totalUser = await User.countDocuments();

        const dashboardData = {
            totalBookings: bookings.length,
            totalRevenue: bookings.reduce((acc, booking)=> acc + booking.amount, 0),
            activeShows,
            totalUser
        }
        res.json({success: true, dashboardData})

    } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message})
    
    }
}

// API to get all shows
export const getAllShows = async (req, res) => {
    try {
        const shows = await Show.find({showDateTime: {$gte: new Date()}}).populate('movie').sort({ showDateTime: 1})
        res.json({success: true, shows})

    } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message})
    }
}

// API to get all bookings
export const getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({}).populate('user').populate({
            path: "show",
            populate: {path: "movie"}
        }).sort({createdAt: -1 })
        res.json({success: true, bookings})

    } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message})
    }
}


// HÀM MỚI: API ĐỂ RESET DATABASE
export const resetDatabase = async (req, res) => {
    try {
        // Xóa theo đúng thứ tự để không vi phạm ràng buộc
        
        // 1. Xóa tất cả Bookings (Vé)
        await Booking.deleteMany({});

        // 2. Xóa tất cả Shows (Lịch chiếu)
        await Show.deleteMany({});

        // 3. Xóa tất cả Movies (Phim)
        await Movie.deleteMany({});

        // Collection 'User' được giữ nguyên vì nó đồng bộ từ Clerk

        res.json({ success: true, message: "Đã xóa toàn bộ Phim, Lịch chiếu và Vé." });

    } catch (error) {
        console.error("Lỗi khi reset database:", error);
        res.json({ success: false, message: "Lỗi máy chủ khi reset." });
    }
}