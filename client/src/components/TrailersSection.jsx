import React, { useState, useEffect } from 'react'
import BlurCircle from './BlurCircle';
import ReactPlayer from 'react-player';
import { PlayCircleIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const TrailersSection = () => {

    const { shows } = useAppContext(); // Lấy 'shows' (là danh sách Movies) từ context

    // 1. Chuyển đổi 'shows' thành định dạng 'trailers'
    const trailers = shows
        .map(movie => ({
            id: movie._id,
            // Sử dụng thumbnail từ YouTube, fallback về backdrop của phim
            thumbnail: movie.trailerKey 
                ? `https://img.youtube.com/vi/${movie.trailerKey}/mqdefault.jpg` // mqdefault (medium) an toàn hơn maxresdefault
                : `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
            videoUrl: movie.trailerKey 
                ? `https://www.youtube.com/watch?v=${movie.trailerKey}`
                : null,
            trailerKey: movie.trailerKey,
            title: movie.title
        }))
        .filter(trailer => trailer.trailerKey); // Chỉ hiển thị những phim CÓ trailerKey

    const [currentTrailer, setCurrentTrailer] = useState(null);

    // 2. Cập nhật trailer đang phát khi 'trailers' thay đổi
    useEffect(() => {
        if (trailers.length > 0 && !currentTrailer) {
            setCurrentTrailer(trailers[0]);
        }
    }, [trailers, currentTrailer]);

    // 3. Nếu không có trailer nào thì không hiển thị section này
    if (trailers.length === 0) {
        return null;
    }

  return (
    <div className='px-6 md:px-16 lg:px-24 xl:px-44 py-20 overflow-hidden'>
      <p className='text-gray-300 font-medium text-lg max-w-[960px] mx-auto'>Trailers</p>
      <div className='relative mt-6'>
        <BlurCircle top='-100px' right='-100px' />
        {/* 4. Chỉ hiển thị ReactPlayer khi có currentTrailer */}
        {currentTrailer && (
            <ReactPlayer 
                url={currentTrailer.videoUrl} 
                controls={true} 
                className="mx-auto max-w-full" 
                width="960px" 
                height="540px"
                onReady={() => console.log('ReactPlayer: Ready')}
                onStart={() => console.log('ReactPlayer: Start')}
                onError={(e) => console.error('ReactPlayer Error:', e)}
            />
        )}
      </div>

      {/* 5. Hiển thị danh sách thumbnail động (lấy 4 trailer đầu tiên) */}
      <div className='group grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mt-8 max-w-3xl mx-auto'>  
        {trailers.slice(0, 4).map((trailer)=>(
          <div 
            key={trailer.id} 
            className='relative group-hover:not-hover:opacity-50 hover:-translate-y-1 duration-300 transition aspect-video cursor-pointer' 
            onClick={() => setCurrentTrailer(trailer)}
          >
            <img src={trailer.thumbnail} alt={trailer.title} className='rounded-lg w-full h-full object-cover brightness-75' />
            <div className='absolute bottom-0 left-0 p-2'>
                <p className='text-white text-xs font-medium truncate'>{trailer.title}</p>
            </div>
            <PlayCircleIcon strokeWidth={1.6} className="absolute top-1/2 left-1/2 w-8 h-8 md:w-12 md:h-12 transform -translate-x-1/2 -translate-y-1/2"/>
          </div>
        ))}
      </div>

    </div>
  )
}

export default TrailersSection