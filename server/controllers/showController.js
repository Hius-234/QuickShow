import axios from "axios"
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";
import { inngest } from "../inngest/index.js";

// API to get now playing movies from TMDB API
export const getNowPlayingMovies = async (req, res) => {
    try {
        const { data } = await axios.get('https://api.themoviedb.org/3/movie/now_playing', {
            headers: {Authorization : `Bearer ${process.env.TMDB_API_KEY}`}
        })

        const movies = data.results;
        res.json({success: true, movies: movies})
    } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message})
    }
}

// Hàm trợ giúp để lấy và tìm trailerKey
const getTrailerKeyFromTMDB = async (movieId) => {
    try {
        const { data } = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}/videos`, {
            headers: {Authorization : `Bearer ${process.env.TMDB_API_KEY}`} 
        });

        const movieVideosData = data.results;
        let trailerKey = null;

        const officialTrailer = movieVideosData.find(video => video.type === 'Trailer' && video.site === 'YouTube');
        if (officialTrailer) {
            trailerKey = officialTrailer.key;
        } else {
            const anyYouTubeVideo = movieVideosData.find(video => video.site === 'YouTube');
            if (anyYouTubeVideo) {
                trailerKey = anyYouTubeVideo.key;
            }
        }
        return trailerKey;
    } catch (error) {
        console.error("Lỗi khi lấy trailer key:", error.message);
        return null;
    }
}

// API to add a new show to the database
export const addShow = async (req, res) => {
    try {
        const {movieId, showsInput, showPrice} = req.body

        let movie = await Movie.findById(movieId)

        if(!movie){
            // --- KHI PHIM CHƯA TỒN TẠI ---
            // Fetch movie details, credits, AND VIDEOS from TMDB API
            const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
                    headers: {Authorization : `Bearer ${process.env.TMDB_API_KEY}`}
                }),
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
                    headers: {Authorization : `Bearer ${process.env.TMDB_API_KEY}`} 
                })
            ]);

            const movieApiData = movieDetailsResponse.data;
            const movieCreditsData = movieCreditsResponse.data;
            
            // Lấy trailerKey
            const trailerKey = await getTrailerKeyFromTMDB(movieId);

            const movieDetails = {
                _id: movieId,
                title: movieApiData.title,
                overview: movieApiData.overview,
                poster_path: movieApiData.poster_path,
                backdrop_path: movieApiData.backdrop_path,
                release_date: movieApiData.release_date,
                original_language: movieApiData.original_language,
                tagline: movieApiData.tagline || "",
                genres: movieApiData.genres,
                casts: movieCreditsData.cast,
                vote_average: movieApiData.vote_average,
                runtime: movieApiData.runtime,
                trailerKey: trailerKey // Lưu trailerKey
            }

            movie = await Movie.create(movieDetails);
        } else if (!movie.trailerKey) {
            // --- SỬA LỖI: KHI PHIM ĐÃ TỒN TẠI NHƯNG THIẾU TRAILERKEY ---
            console.log(`Phim "${movie.title}" đã tồn tại nhưng thiếu trailerKey. Đang lấy trailer...`);
            const trailerKey = await getTrailerKeyFromTMDB(movieId);
            if (trailerKey) {
                movie.trailerKey = trailerKey;
                await movie.save();
                console.log(`Đã cập nhật trailerKey cho phim "${movie.title}".`);
            }
        }

        // --- Tạo các suất chiếu (Show) ---
        const showsToCreate = [];
        showsInput.forEach(show => {
            const showDate = show.date;
            show.time.forEach((time)=> {
                const dateTimeString = `${showDate}T${time}`;
                showsToCreate.push({
                    movie: movieId,
                    showDateTime: new Date(dateTimeString),
                    showPrice,
                    occupiedSeats: {}
                })
            })
        });

        if(showsToCreate.length > 0){
            await Show.insertMany(showsToCreate);
        }

        // Trigger Inngest event
        await inngest.send({
            name: "app/show.added",
            data: {movieTitle: movie.title}
        })

        res.json({success: true, message: 'Show added successfully'})

    } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message})
    }
}

// API to get all shows from the database
export const getShows = async (req, res) => {
    try {
        const shows = await Show.find({showDateTime: {$gte: new Date()}}).populate('movie').sort({showDateTime: 1});
        
        // Lấy danh sách phim duy nhất từ các suất chiếu
        const uniqueMoviesMap = new Map();
        shows.forEach(show => {
            if (show.movie) { // Đảm bảo movie tồn tại
                uniqueMoviesMap.set(show.movie._id, show.movie);
            }
        });

        const uniqueMovies = Array.from(uniqueMoviesMap.values());

        res.json({success: true, shows: uniqueMovies})
    } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message});
    }
}

// API to get a single show from the database
export const getShow = async (req, res) => {
    try {
        const {movieId} = req.params;
        // get all upcoming shows for the movie
        const shows = await Show.find({movie: movieId, showDateTime: { $gte: new Date() }})

        const movie = await Movie.findById(movieId);
        const dateTime = {};

        shows.forEach((show) => {
            const date = show.showDateTime.toISOString().split("T")[0];
            if(!dateTime[date]){
                dateTime[date] = []
            }
            dateTime[date].push({ time: show.showDateTime, showId: show._id })
        })
        res.json({success: true, movie, dateTime})
    } catch (error) {
        console.error(error);
        res.json({success: false, message: error.message});
    }

}