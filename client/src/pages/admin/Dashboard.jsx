import { ChartLineIcon, CircleDollarSignIcon, PlayCircleIcon, StarIcon, UserIcon, Trash2Icon } from 'lucide-react'; // Thêm Trash2Icon
import React, { useEffect, useState } from 'react'
import Loading from '../../components/Loading';
import Title from './Title';
import BlurCircle from '../../components/BlurCircle';
import dateFormat from '../../lib/dateFormat';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';

const DashBoard = () => {

    const currency = import.meta.env.VITE_CURRENCY

    const {axios, getToken, user, image_base_url, fetchShows} = useAppContext()  // Thêm fetchShows

    const [dashboardData, setDashboardData] = useState({
        totalBookings: 0,
        totalRevenue: 0,
        activeShows: [],
        totalUser: 0
    });
    const [loading, setLoading] = useState(true)

    const dashboardCards = [
        {title: "Total Bookings", value: dashboardData.totalBookings || "0", icon: ChartLineIcon},
        {title: "Total Revenue", value: currency + dashboardData.totalRevenue || "0", icon: CircleDollarSignIcon},
        {title: "Active Shows", value: dashboardData.activeShows.length || "0", icon: PlayCircleIcon},
        {title: "Total Users", value: dashboardData.totalUser || "0", icon: UserIcon}
    ]

    const fetchDashboardData = async () => {
        try {
            const {data} = await axios.get("/api/admin/dashboard", {headers: {Authorization: `Bearer ${await getToken()}`}})
            if(data.success){
                setDashboardData(data.dashboardData)
                setLoading(false)
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            toast.error("Error fetching dashboard data:", error)
        }
    };

    // HÀM MỚI: Xử lý reset database
    const handleResetDatabase = async () => {
        // Hiển thị hộp thoại xác nhận CỦA TRÌNH DUYỆT
        // Lưu ý: Đây là trường hợp hiếm hoi dùng 'confirm' là chấp nhận được vì nó an toàn
        if (window.confirm("BẠN CÓ CHẮC KHÔNG?\nHành động này sẽ XÓA TẤT CẢ Phim, Lịch chiếu, và Vé đã đặt. KHÔNG THỂ khôi phục.")) {
            if (window.confirm("XÁC NHẬN LẦN 2:\nBạn có thực sự muốn xóa toàn bộ dữ liệu không?")) {
                try {
                    setLoading(true);
                    const token = await getToken();
                    const { data } = await axios.post('/api/admin/reset-database', {}, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (data.success) {
                        toast.success(data.message);
                        // Tải lại dữ liệu dashboard và danh sách phim (để frontend được cập nhật)
                        await fetchDashboardData();
                        await fetchShows(); // Cập nhật danh sách phim (giờ sẽ rỗng)
                    } else {
                        toast.error(data.message);
                        setLoading(false);
                    }
                } catch (err) {
                    toast.error("Đã xảy ra lỗi khi reset: " + err.message);
                    setLoading(false);
                }
            } else {
                toast("Đã hủy hành động reset.", { icon: 'ℹ️' });
            }
        } else {
            toast("Đã hủy hành động reset.", { icon: 'ℹ️' });
        }
    }


    useEffect(() => {
        if(user){
            fetchDashboardData();
        }        
    }, [user]);

  return !loading ? (
    <>
        <Title text1="Admin" text2="Dashboard"/>

        <div className='relative flex flex-wrap gap-4 mt-6'>
            <BlurCircle top='-100px' left='0'/>
            <div className='flex flex-wrap gap-4 w-full'>
                {dashboardCards.map((card, index) =>(
                    <div key={index} className='flex items-center justify-between px-4 py-3 bg-primary/10 border border-primary/20 rounded-md max-w-50 w-full'>
                        <div>
                            <h1 className='text-sm'>{card.title}</h1>
                            <p className='text-xl font-medium mt-1'>{card.value}</p>
                        </div>
                        <card.icon className="w-6 h-6" />
                    </div>
                ))}
            </div>
        </div>

        <p className='mt-10 text-lg font-medium'>Active Shows</p>
        <div className='relative flex flex-wrap gap-6 mt-4 max-w-5xl'>
            <BlurCircle top='100px' left='-10%'/>
            {/* Hiển thị nếu không có show */}
            {dashboardData.activeShows.length === 0 && (
                <p className='text-gray-400'>Không có suất chiếu nào đang hoạt động.</p>
            )}

            {dashboardData.activeShows.map((show) => (
                <div key={show._id} className='w-55 rounded-lg overflow-hidden h-full pb-3 bg-primary/10 border border-primary/20 hover:-translate-y-1 transition duration-300'>
                    <img src={image_base_url + show.movie.poster_path} alt='' className='h-60 w-full object-cover' />
                    <p className='font-medium p-2 truncate'>{show.movie.title}</p>
                    <div className='flex items-center justify-between px-2'>
                        <p className='text-lg font-medium'>{currency} {show.showPrice}</p>
                        <p className='flex items-center gap-1 text-sm text-gray-400 mt-1 pr-1'>
                            <StarIcon className='w-4 h-4 text-primary fill-primary' />
                            {show.movie.vote_average.toFixed(1)}
                        </p>
                    </div>
                    <p className='px-2 pt-2 text-sm text-gray-500'>{dateFormat(show.showDateTime)}</p>
                </div>
            ))}                
        </div>

        {/* PHẦN MỚI: VÙNG NGUY HIỂM */}
        <div className='mt-16 p-4 border border-red-500/50 rounded-lg max-w-2xl bg-red-500/5'>
            <h2 className='text-lg font-semibold text-red-400'>Khu vực nguy hiểm</h2>
            <p className='text-sm text-gray-400 mt-2'>
                Nhấn nút này sẽ xóa toàn bộ dữ liệu phim, lịch chiếu, và vé đã đặt.
                Hành động này không thể khôi phục. Chỉ dùng khi bạn muốn thiết lập lại ứng dụng từ đầu.
            </p>
            <button
                onClick={handleResetDatabase}
                className='mt-4 flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition active:scale-95'
            >
                <Trash2Icon className='w-4 h-4' />
                Reset Toàn Bộ Dữ Liệu
            </button>
        </div>

    </>
  ) : <Loading />
}

export default DashBoard