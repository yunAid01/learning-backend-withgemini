// src/middlewares/authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// req 객체에 user 정보를 추가하기 위해 Express의 Request 타입을 확장합니다.
export interface AuthRequest extends Request {
  user?: { id: number };
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  // 1. 요청 헤더에서 'Authorization' 값을 찾습니다.
  const authHeader = req.headers['authorization'];

  // 2. 헤더가 없거나, 'Bearer '로 시작하지 않으면 에러 처리
  // JWT는 보통 'Bearer <토큰>' 형식으로 전달됩니다.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required' });
  }

  // 3. 'Bearer ' 부분을 잘라내고 실제 토큰 값만 추출합니다.
  const token = authHeader.split(' ')[1];

  try {
    // 4. JWT_SECRET을 사용해 토큰을 검증(verify)합니다.
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
    
    // 5. 검증에 성공하면, 해독된(decoded) 페이로드에서 userId를 추출하여
    // req.user에 저장합니다. 이제 이 요청을 처리하는 모든 로직에서 req.user를 쓸 수 있습니다.
    req.user = { id: decoded.userId };
    
    // 6. 다음 미들웨어나 API 로직으로 요청을 넘깁니다.
    next();
  } catch (error) {
    // 7. 토큰이 유효하지 않은 경우 (만료, 변조 등)
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export default authMiddleware;