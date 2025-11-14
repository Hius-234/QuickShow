import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BlurCircle from '../components/BlurCircle.jsx';
import { Heart, PlayCircleIcon, StarIcon, XIcon } from 'lucide-react'; // Thêm XIcon
import timeFormat from '../lib/timeFormat.js';
import DateSelect from '../components/DateSelect.jsx';
import MovieCard from '../components/MovieCard.jsx';
import Loading from '../components/Loading.jsx';
import { useAppContext } from '../context/AppContext.jsx';
import toast from 'react-hot-toast';
import ReactPlayer from 'react-player/youtube'; // Import ReactPlayer

const MovieDetails = () => {

    const navigate = useNavigate()
    const {id} = useParams()
    const [show, setShow] = useState(null)
    const [showTrailerModal, setShowTrailerModal] = useState(false); // State để điều khiển modal

    const {shows, axios, getToken, user, fetchFavoriteMovies, favoriteMovies, image_base_url} = useAppContext()


    const getShow = async () => {
        try {
            const {data} = await axios.get(`/api/show/${id}`)
            if(data.success){
                setShow(data)
            }
        } catch (error) {
            console.log(error)
        }
    }

    const handleFavorite = async ()=>{
        try {
            if(!user) return toast.error("Please logon to proceed");

            const {data} = await axios.post('/api/user/update-favorite', {movieId: id}, 
            {headers: { Authorization: `Bearer ${await getToken()}` }})

            if(data.success){
                await fetchFavoriteMovies()
                toast.success(data.message)
            }
        } catch (error) {
            console.log(error)
        }
    }

    useEffect(()=>{    
        getShow();
    }, [id])


    return show ? (
        <>
            <div className='px-6 md:px-16 lg:px-40 pt-30 md:pt-50'>
                <div className='flex flex-col md:flex-row gap-8 max-w-6xl mx-auto'>
                    <img src={image_base_url + show.movie.poster_path} alt="" className='max-md:mx-auto rounded-xl h-104 max-w-70 object-cover' />
                    <div className='relative flex flex-col gap-3'>
                        <BlurCircle top="-100px" left="-100px"/>
                        <p className='text-primary'>English</p>
                        <h1 className='text-4xl font-semibold max-w-96 text-balance'>{show.movie.title}</h1>
                        <div className='flex items-center gap-2 to-gray-300'>
                            <StarIcon className='w-5 h-5 text-primary fill-primary'/>{show.movie.vote_average.toFixed(1)} 
                            User Rating
                        </div>

                        <p className='text-gray-400 mt-2 text-sm leading-tight max-w-xl'>{show.movie.overview}</p>

                        <p>
                            {timeFormat(show.movie.runtime)} • {show.movie.genres.map(genre => genre.name).join(", ")} • {show.movie.release_date.split("-")[0]}
                        </p>

                        <div className='flex items-center flex-wrap gap-4 mt-4'>
                            {/* Cập nhật nút Watch Trailer */}
                            {show.movie.trailerKey && (
                                <button 
                                    onClick={() => setShowTrailerModal(true)} 
                                    className='flex items-center gap-2 px-7 py-3 text-sm bg-gray-800 hover:bg-gray-900 transition rounded-md font-medium cursor-pointer active:scale-95'>
                                    <PlayCircleIcon className='w-5 h-5'/>
                                    Watch Trailer
                                </button>
                            )}
                            <a href='#dateSelect' className='px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-md font-medium cursor-pointer active:scale-95'>
                                Buy Tickets</a>
                            <button onClick={handleFavorite} className='bg-gray-700 p-2.5 rounded-full transition cursor-pointer active:scale-95'>
                                <Heart className={`w-5 h-5 ${favoriteMovies.find(movie => movie._id === id) ? 'fill-primary text-primary' : ""}`}/>
                            </button>
                        </div>
                    </div>
                </div>

                <p className='text-lg font-medium mt-20'>Your Favorite Cast</p>
                <div className='overflow-x-auto no-scrollbar mt-8 pb-4'>
                    <div className='flex items-center gap-4 w-max px-4'>{show.movie.casts.slice(0,12).map((cast, index)=>(
                        <div key={index} className='flex flex-col items-center text-center'>
                            <img src={image_base_url + cast.profile_path} alt="" className='rounded-full h-20 md:h-20 aspect-square object-cover'/>
                            <p className='font-medium text-xs mt-3'>{cast.name}</p>
                        </div>
                    ))}
                    </div>
                </div>

                <DateSelect dateTime={show.dateTime} id={id} />

                <p className='text-lg font-medium mt-20 mb-8'>You May Also Like</p>
                <div className='flex flex-wrap justify-center gap-8'>
                    {shows.slice(0,4).map((movie, index)=>(
                        <MovieCard key={index} movie={movie} />
                    ))}
                </div>
                <div className='flex justify-center mt-20'>
                    <button onClick={()=> {navigate('/movies'); scrollTo(0,0)}} className='px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-md font-medium cursor-pointer'>Show More</button>
                </div>

            </div>

            {/* MODAL CHIẾU TRAILER */}
            {showTrailerModal && show.movie.trailerKey && (
                <div 
                    className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 backdrop-blur-sm p-4"
                    onClick={() => setShowTrailerModal(false)} // Đóng modal khi click ra ngoài
                >
                    <div 
                        className="relative w-full max-w-4xl bg-black rounded-lg overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()} // Ngăn việc click vào video làm đóng modal
                    >
                        <button 
                            onClick={() => setShowTrailerModal(false)} 
                            className="absolute top-2 right-2 z-10 text-white bg-black/50 rounded-full p-1 cursor-pointer hover:bg-black/80 transition-colors"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                        <div className='aspect-video'>
                            <ReactPlayer 
                                url={`https://www.youtube.com/watch?v=${show.movie.trailerKey}`}
                                width='100%'
                                height='100%'
                                controls={true}
                                playing={true} // Tự động phát khi mở
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    ) : <Loading />;
};

export default MovieDetails;
