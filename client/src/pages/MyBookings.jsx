import React, { useEffect, useState } from 'react';
import Loading from '../components/Loading.jsx';
import BlurCircle from '../components/BlurCircle.jsx';
import timeFormat from '../lib/timeFormat.js';
import dateFormat from '../lib/dateFormat.js';
import { useAppContext } from '../context/AppContext.jsx';
import { Link } from 'react-router-dom';

const MyBookings = () => {
    const currency = import.meta.env.VITE_CURRENCY || '$'; // Thêm fallback
    const { axios, getToken, user, image_base_url} = useAppContext();

    const [upcomingBookings, setUpcomingBookings] = useState([]);
    const [pastBookings, setPastBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Hàm kiểm tra và cập nhật trạng thái các vé chưa thanh toán
    const verifyUnpaidBookings = async (bookings, token) => {
        const now = new Date();
        const upcoming = [];
        const past = [];
        
        // Lọc ra các vé chưa thanh toán và còn hạn
        const unpaidUpcomingBookings = bookings.filter(b => 
            !b.isPaid && b.show && new Date(b.show.showDateTime) >= now && b.paymentLink
        );

        // Tạo mảng các promise để kiểm tra trạng thái
        const statusChecks = unpaidUpcomingBookings.map(booking => 
            axios.post('/api/booking/check-status', { bookingId: booking._id }, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => res.data.booking) // Trả về booking đã cập nhật
             .catch(err => {
                console.log("Check status error for", booking._id, err);
                return booking; // Trả về booking gốc nếu lỗi
             })
        );

        // Chờ tất cả các API check-status hoàn thành
        const verifiedBookings = await Promise.all(statusChecks);

        // Tạo một map để cập nhật dễ dàng
        const verifiedMap = new Map(verifiedBookings.map(b => [b._id, b]));

        // Gộp lại danh sách booking đã được cập nhật
        const allBookings = bookings.map(b => verifiedMap.get(b._id) || b);

        // Phân loại lại vé sau khi đã kiểm tra
        allBookings.forEach(item => {
            if (item.show && item.show.showDateTime) {
                if (new Date(item.show.showDateTime) >= now) {
                    upcoming.push(item);
                } else {
                    past.push(item);
                }
            }
        });

        setUpcomingBookings(upcoming);
        setPastBookings(past);
    };

    const getMyBookings = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const token = await getToken();
            const {data} = await axios.get('/api/user/bookings', {
                headers: {Authorization: `Bearer ${token}`}
            });
            
            if(data.success) {
                // Sau khi lấy vé, hãy kiểm tra các vé chưa thanh toán
                await verifyUnpaidBookings(data.bookings, token);
            }
        } catch (error) {
            console.log(error);
        }
        setIsLoading(false);
    };

    useEffect(()=>{
        getMyBookings(); 
        // Component sẽ re-render khi user thay đổi
    }, [user]);

    // Component con để render một thẻ đặt vé
    const BookingCard = ({ item }) => (
        <div className='flex flex-col md:flex-row justify-between bg-primary/8 border border-primary/20 rounded-lg mt-4 p-2 w-full'>
            <div className='flex flex-col md:flex-row'>
                {/* Kiểm tra item.show và item.show.movie trước khi render */}
                <img 
                    src={item.show?.movie?.poster_path ? image_base_url + item.show.movie.poster_path : 'https://placehold.co/180x101/222/FFF?text=No+Image'} 
                    alt={item.show?.movie?.title || 'Movie'} 
                    className='md:max-w-45 aspect-video h-auto object-cover object-bottom rounded'
                />
                <div className='flex flex-col p-4'>
                    <p className='text-lg font-semibold'>{item.show?.movie?.title || 'Unknown Movie'}</p>
                    <p className='text-gray-400 text-sm'>{item.show?.movie?.runtime ? timeFormat(item.show.movie.runtime) : 'N/A'}</p>
                    <p className='text-gray-400 text-sm mt-auto'>{item.show?.showDateTime ? dateFormat(item.show.showDateTime) : 'N/A'}</p>
                </div>
            </div>

            <div className='flex flex-col md:items-end md:text-right justify-between p-4'>
                <div className='flex items-center gap-4'>
                    <p className='text-2xl font-semibold mb-3'>{currency}{item.amount}</p>
                    {/* Nút Pay Now chỉ hiển thị nếu CHƯA TRẢ TIỀN và có paymentLink */}
                    {!item.isPaid && item.paymentLink && (
                        <Link to={item.paymentLink} target="_blank" rel="noopener noreferrer" className='bg-primary px-4 py-1.5 mb-3 text-sm rounded-full font-medium cursor-pointer whitespace-nowrap'>
                            Pay Now
                        </Link>
                    )}
                </div>
                <div className='text-sm'>
                    <p><span className='text-gray-400'>Total Tickets:</span> {item.bookedSeats.length}</p>
                    <p><span className='text-gray-400'>Seat Number:</span> {item.bookedSeats.join(", ")}</p>
                </div>
            </div>
        </div>
    );


    return !isLoading ? (
        <div className='relative px-6 md:px-16 lg:px-40 placeholder-teal-300 pt-32 md:pt-40 min-h-[80vh]'>
            <BlurCircle top='100px' left='100px' />
            <div>
                <BlurCircle bottom='0px' left='600px' />
            </div>
            
            {/* Phần vé sắp diễn ra */}
            <h1 className='text-xl font-semibold mb-4'>My Upcoming Bookings</h1>
            <div className='max-w-3xl'>
                {upcomingBookings.length > 0 ? (
                    upcomingBookings.map((item,index)=>(
                        <BookingCard key={item._id || index} item={item} />
                    ))
                ) : (
                    <p className='text-gray-400'>You have no upcoming bookings.</p>
                )}
            </div>

            {/* Phần vé đã qua */}
            <h1 className='text-xl font-semibold mb-4 mt-16'>My Past Bookings</h1>
            <div className='max-w-3xl opacity-60'> {/* Làm mờ vé đã qua */}
                {pastBookings.length > 0 ? (
                    pastBookings.map((item,index)=>(
                        <BookingCard key={item._id || index} item={item} />
                    ))
                ) : (
                    <p className='text-gray-400'>You have no past bookings.</p>
                )}
            </div>
        </div>
    ) : <Loading />
};

export default MyBookings;
