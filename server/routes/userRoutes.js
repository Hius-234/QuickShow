import express from "express";
import { getUserBookings, getFavorites, updateFavorite } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get('/bookings', getUserBookings)
userRouter.post('/update-favourite', updateFavorite)
userRouter.get('/favorites', getFavorites)

export default userRouter;