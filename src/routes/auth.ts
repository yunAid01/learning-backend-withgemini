// src/routes/auth.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client'; // 프리즈마 사용 리모컨 
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


const router = Router();
const prisma = new PrismaClient();

// [C] User Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // 1. 이메일로 사용자 찾기
    const user = await prisma.user.findUnique({ where: { email: email } });
    if (!user || !user.password) {
      // 사용자가 없거나, password 필드가 없는 경우 (보안을 위해 에러 메시지는 통일)
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2. 입력된 비밀번호와 DB의 해시된 비밀번호 비교
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // 비밀번호가 틀린 경우
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3. 비밀번호가 맞다면, '출입증(JWT)' 생성
    const token = jwt.sign(
      { userId: user.id }, // 출입증에 담을 정보 (페이로드)
      process.env.JWT_SECRET as string, // 비밀 서명 키
      { expiresIn: '1h' } // 유효기간 (1시간)
    );

    // 4. 출입증을 클라이언트에게 전달
    res.status(200).json({ token });

  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});


export default router;