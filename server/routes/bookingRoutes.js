import express from "express";
import { createBooking, getOccupiedSeats, checkBookingStatus } from "../controllers/bookingController.js";

const bookingRouter = express.Router();

bookingRouter.post('/create', createBooking);
bookingRouter.get('/seats/:showId', getOccupiedSeats);

bookingRouter.post('/check-status', checkBookingStatus);

export default bookingRouter;