import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client'; // 1. PrismaClient를 import
// 파일 상단에 bcrypt를 import 합니다.
import bcrypt from 'bcrypt';
// ... (다른 import 문들)
import authMiddleware, { AuthRequest } from '../middlewares/authMiddleware';


const prisma = new PrismaClient(); // 2. prisma 객체 생성
// express 앱 대신 Router를 가져옵니다. Router는 미니 express 앱과 같습니다.
const router = Router();

// 인터페이스

interface User {
  id: number;
  username: string;
  email: string;
  password?: string;
}

// prisma로 refactoring
// 전체 사용자 조회
// [R] Read All Users
router.get('/', async (req: Request, res: Response) => { // 'async' 추가!
  // prisma의 user 테이블에 가서 모든(findMany) 데이터를 찾아줘!
  const allUsers = await prisma.user.findMany(); // 'await' 추가!

  res.status(200).json(allUsers);
});

// [R] Read One User by ID
router.get('/:id', async (req: Request, res: Response) => { // async 추가
  const userId = parseInt(req.params.id, 10);

  try {
    const userWithPosts = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        posts: { // 👈 이 사용자가 작성한 'posts'를 포함시킵니다.
          orderBy: {
            createdAt: 'desc' // 게시물은 최신순으로 정렬
          },
          // 👇 이 중첩 include가 필요합니다! post 안의 관계들
          include: {
            author: true,
            likes: true,
            comments: true,
          }
        }, 
        // 👇 '나를 팔로우하는 관계' 목록을 포함시킵니다.
        followers: {
        select: {
          followerId: true // 전체 정보 대신, 팔로워의 ID만 선택해서 가져옵니다.
        }
        }
      }
    });

    if (!userWithPosts) {
      return res.status(404).json({ message: 'User not found' });
    }

    // (보안) 응답 데이터에서 password 필드는 제거하고 보냅니다.
    const { password, ...userWithoutPassword } = userWithPosts;
    res.status(200).json(userWithoutPassword);

  } catch (error) {
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// [C] Create User
router.post('/', async (req: Request, res: Response) => { // 1. async 추가
  const { username, email, password } = req.body;

  // 유효성 검사는 그대로 두어도 좋습니다.
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // --- 👇 여기가 바뀝니다! ---

  try {
    // 1. 비밀번호를 해싱합니다. (시간이 걸리는 작업이므로 await 사용)
    // bcrypt.hash(해싱할_값, 암호화_강도); 강도는 보통 10~12를 사용합니다.
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. 해싱된 비밀번호를 데이터베이스에 저장합니다.
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword, // 👈 원래 비밀번호 대신 암호화된 비밀번호를 저장
      },
    });

    // (보안) 응답으로 비밀번호 정보를 보내지 않는 것이 좋습니다.
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);

  } catch (error) {
    // email @unique 제약조건 위반 시 등
    console.error(error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// [R] Get all Posts liked by a specific User
router.get('/:id/likes', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id, 10);

  try {
    const userLikes = await prisma.like.findMany({
      where: {
        userId: userId, // 1. 특정 유저가 누른 '좋아요'만 필터링
      },
      include: {
        post: true, // 2. 그 '좋아요'에 연결된 'Post' 정보를 함께 가져옴
      }
    });

    // 3. (데이터 가공) 결과는 [ { id, postId, userId, post: {...} }, ... ] 형태입니다.
    // 클라이언트가 사용하기 편하도록 실제 Post 객체만 추출해서 새로운 배열을 만듭니다.
    const likedPosts = userLikes.map(like => like.post);

    res.status(200).json(likedPosts);
  } catch (error) {
    res.status(500).json({ message: "Could not fetch user's liked posts" });
  }
});

// [C] Follow a User
router.post('/:id/follow', authMiddleware, async (req: AuthRequest, res: Response) => {
  // 팔로우를 '하는' 사람 (나 자신)의 ID는 미들웨어가 검증해준 req.user에서 가져옵니다.
  const followerId = req.user!.id;
  // 팔로우를 '당할' 사람 (상대방)의 ID는 URL 파라미터에서 가져옵니다.
  const followedId = parseInt(req.params.id, 10);

  // 자기 자신을 팔로우하는 것은 막아야 합니다.
  if (followerId === followedId) {
    return res.status(400).json({ message: "You cannot follow yourself." });
  }

  try {
    // Follows 테이블에 새로운 관계를 생성합니다.
    const newFollow = await prisma.follows.create({
      data: {
        followerId: followerId,
        followedId: followedId,
      }
    });

    res.status(201).json({ message: "Successfully followed user.", data: newFollow });
  } catch (error) {
    // Prisma 에러 (e.g., 이미 팔로우한 경우 @@id 중복 에러 발생)
    // 혹은 존재하지 않는 유저를 팔로우하려는 경우 등
    res.status(500).json({ message: "Could not follow user. The user may already be followed or does not exist." });
  }
});

// [D] UnFollow a User
router.delete('/:id/follow', authMiddleware, async (req: AuthRequest, res: Response) => {
  const followedId = parseInt(req.params.id, 10);
  // 1. (가장 중요!) 팔로우를 하는 사람의 ID는 반드시 req.user에서 가져옵니다.
  const followerId = req.user!.id;

  // 자기 자신을 언팔로우하는 로직은 유효하며 좋은 방어 코드입니다.
  if (followerId === followedId) {
    return res.status(400).json({ message: "You cannot unfollow yourself." });
  }

  try {
    await prisma.follows.delete({
      where: {
        // 복합 키를 정확하게 사용하셨습니다. 완벽합니다!
        followerId_followedId: {
          followerId: followerId,
          followedId: followedId,
        }
      }
    });

    // 2. 성공 상태코드는 200 OK가 더 좋습니다.
    res.status(200).json({ message: "Successfully unfollowed user." });
  } catch (error) {
    // 3. 삭제할 관계를 찾지 못한 것이므로, 404 Not Found가 더 의미에 맞습니다.
    res.status(404).json({ message: "Follow relationship not found." });
  }
});
// [D] UnFollow a User -> 내가 짠 코드
// (delete) http://localhost/user/3/follow 
// router.delete('/:id/follow', authMiddleware, async (req: AuthRequest, res: Response) => {
//   const followedId = parseInt(req.params.id, 10);
//   const followerId = req.user!.id;

  // followeded -> 팔로우됐던것을 취소하기 위하는 것이니깐 ed를 없애야 함
//   if(!followedId) {
//     return res.status(404).json({ message: "user not found"})
//   };
//   if (followedId === followerId) {
//     return res.status(403).json({ message: "you cant unfollow yourself"})
//   };  
//   try {
//     await prisma.follows.delete({
//       where: { followerId_followedId: { followedId, followerId}}
//     })
//     res.status(201).json({ message: "successfully deleted !"})
//   } catch (err) {
//     return res.status(500).json({ message: "you can't unfollow"})
//   }
// });

// [R] Get a user's followers
// 날 팔로우한 사람들을 차는 로직
// (get) /user/:id/followers
router.get('/:id/followers', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id, 10);

  try {
    const followers = await prisma.follows.findMany({
      where: {
        followedId: userId,
      },
      include: {
        follower: true,
      },
    });

    // 실제 유저 정보만 추출하여 배열로 만듭니다.
    const followerUsers = followers.map(follow => follow.follower); 

    res.status(200).json(followerUsers);
  } catch (error) {
    res.status(500).json({ message: "Could not fetch followers." });
  }
});

// 내가 팔로우 한 사람들을 찾는 로직
router.get('/:id/followings', authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id, 10);

  try {
    const followings = await prisma.follows.findMany({
      where: { followerId: userId },
      include: { followed: true },
    });

    const followingUsers = followings.map(follow => follow.followed)
    res.status(200).json(followingUsers)
  } catch (err) {
    res.status(500).json({ message: "Could not fetch followings." });
  }

});


// 이 파일에서 설정한 라우터들을 외부에서 사용할 수 있도록 export 해줍니다.
export default router;