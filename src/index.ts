import express from 'express';
// 방금 우리가 만든 '인사팀' 라우터를 import 합니다.
import userRoutes from './routes/users';
import postRoutes from './routes/posts';
import authRoutes from './routes/auth'; // 1. '인증 부서' import

const app = express();
const PORT = 3000;

app.use(express.json());

// 안내 데스크의 역할:

// "주소에 '/users' 라는 단어가 포함된 모든 요청은,
// 이제부터 '인사팀(userRoutes)'에게 넘겨서 처리하세요!" 라는 의미입니다.
app.use('/users', userRoutes);

// 2. '/posts'로 시작하는 모든 요청은 '홍보팀'에게 위임합니다.
app.use('/posts', postRoutes);

// 3. '/auth' 경로로 오는 요청은 '인증 부서'로
app.use('/auth', authRoutes); 

app.get('/', (req, res) => {
  res.send('Welcome to the Main Lobby!');
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});