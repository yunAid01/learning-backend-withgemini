import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

// 👇 아래 두 줄을 추가합니다.
import authMiddleware, { AuthRequest } from '../middlewares/authMiddleware';

const prisma = new PrismaClient(); // prisma remotecontroller
const router = Router();

// [C] Create Post
// [C] Create Post (이제 인증 필요!)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
   console.log("✅ BACKEND CCTV: /posts POST 요청이 API 핸들러에 도착했습니다!"); // 👈 백엔드 CCTV 설치
  // 1. 이제 body에서는 게시물 내용만 받습니다.
  const { imageUrl, caption } = req.body;
  // 2. '누가' 썼는지는, 보안 요원이 검증해준 req.user에서 가져옵니다. (훨씬 안전!)
  const authorId = req.user?.id;
  
  console.log(imageUrl, caption, authorId);

  if (!imageUrl || !caption) {
    return res.status(400).json({ message: 'Image URL and caption are required' });
  }

  // authorId가 없는 경우 (이론상 미들웨어를 통과했다면 항상 있어야 함)
  if (!authorId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const newPost = await prisma.post.create({
      data: {
        imageUrl,
        caption,
        author: {
          connect: { id: authorId } // 👈 검증된 authorId를 사용
        },
      },
    });
    res.status(201).json(newPost);
  } catch (error) {
    console.error("backend catch block err:", error);
    res.status(500).json({ message: 'Error creating post' });
  }
});

// [R] Read All Posts
router.get('/', async (req: Request, res: Response) => {
  const allPosts = await prisma.post.findMany({
    // 👇 이 'include' 옵션을 추가합니다!
    include: {
      likes: true, // 'Post' 모델에 정의된 'likes' 관계를 포함시켜라!
      author: true, // 👈 작성자 정보를 함께 불러옵니다!
    },
    // 💡 꿀팁: 최신 글이 위로 오도록 생성 시간(createdAt) 기준으로 내림차순 정렬!
    orderBy: {
      createdAt: 'desc',  
    }
  });
  res.status(200).json(allPosts); // 204가 아닌 200 OK
});

// [R] Read One Post by ID
router.get('/:id', async (req: Request, res: Response) => {
  console.log("🔥🔥🔥 최신 버전의 GET /posts/:id API가 실행되었습니다! 🔥🔥🔥");

  const postId = parseInt(req.params.id, 10);
  const getOnePost = await prisma.post.findUnique({
    where: { id: postId },
    include: { likes: true, author : true, comments : { // 👈 이 부분이 아마 누락되었을 겁니다!
        include: {
          author: true
        }
      },
  }
  });
  if (!getOnePost) {
    return res.status(404).json({ message: 'Post not found' });
  }
  res.status(200).json(getOnePost); // 204가 아닌 200 OK
});


// [U] Update Post by ID (이제 인증 & 인가 필요!)
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const postId = parseInt(req.params.id, 10);
  const { caption } = req.body; // 수정할 내용
  const userId = req.user!.id; // 👈 이제 req.user.id 에서 사용자 ID를 가져옵니다.

  try {
    // 1. 먼저 DB에서 수정하려는 게시물을 찾습니다.
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    // 2. 게시물이 없는 경우
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // 3. (가장 중요!) '인가' 로직: 게시물의 작성자와 요청을 보낸 사용자가 같은지 확인합니다.
    if (post.authorId !== userId) {
      // 403 Forbidden: 인증은 되었으나 권한이 없음
      return res.status(403).json({ message: 'Forbidden: You do not have permission to edit this post' });
    }

    // 4. 모든 검사를 통과했다면, 데이터를 수정합니다.
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { caption: caption },
    });

    res.status(200).json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: 'Error updating post' });
  }
});


// [D] Delete Post by ID
// Delete http://localhost:3000/post/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const removedPostId = parseInt(req.params.id, 10);
  const userId = req.user!.id;

  try { 
    const removedPost = await prisma.post.findUnique({
      where : { id: removedPostId }
    })
    if (!removedPost) {
      return res.status(404).json({ messgae: "post is not found"})
    }
    if (removedPost.authorId !== userId) {
      return res.status(403).json({ message: "not approved delete"})
    }

    // --- 👇 바로 이 부분입니다! --- 누락해버림 ㅋㅋ
    // 4. 모든 검사를 통과했으니, 실제로 DB에서 게시물을 삭제합니다.
    await prisma.post.delete({
      where: { id: removedPostId }
    });

    res.status(200).json({ messgae: "successfully deleted"})

  } catch (err) {
    return res.status(500).json({ message:"what the fuck"})
  }
});

// src/routes/posts.ts

// [C] Create a Like for a Post (보안 강화 버전)
router.post('/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
  const postId = parseInt(req.params.id, 10);
  const userId = req.user!.id; // Body가 아닌, 검증된 사용자 정보를 사용합니다.

  try {
    const newLike = await prisma.like.create({
      data: {
        postId: postId,
        userId: userId,
      }
    });
    res.status(201).json(newLike);
  } catch (error) {
    res.status(400).json({ message: 'Could not process the like action.' });
  }
});

// [D] Delete a Like for a Post ('Unlike') (보안 강화 버전)
router.delete('/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
  const postId = parseInt(req.params.id, 10);
  const userId = req.user!.id; // Body가 아닌, 검증된 사용자 정보를 사용합니다.

  try {
    await prisma.like.delete({
      where: {
        postId_userId: {
          postId: postId,
          userId: userId,
        }
      }
    });
    res.status(200).json({ message: 'Like removed successfully' });
  } catch (error) {
    res.status(404).json({ message: 'Like not found.' });
  }
});

// GET comments from a post
router.get('/:id/comments', async (req: Request, res: Response) => {
  const postId = parseInt(req.params.id, 10);

  try {
    // 1. (더 안전한 방법) 댓글을 찾기 전에, 해당 게시물이 실제로 존재하는지 먼저 확인합니다.
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      // 게시물이 없다면, 404 에러를 보내고 종료합니다.
      return res.status(404).json({ message: "Post not found" });
    }
    
    // 2. 게시물이 존재한다면, 댓글을 찾습니다. (결과는 빈 배열일 수 있습니다)
    const comments = await prisma.comment.findMany({
      where: { postId: postId },
      // 💡 꿀팁: 댓글 작성자 정보도 함께 보여주면 프론트엔드에서 훨씬 유용하겠죠?
      include: {
        author: {
          select: { // password는 빼고 username과 id만 선택해서 가져옵니다.
            id: true,
            username: true,
          }
        }
      }
    });

    // 3. 성공 응답은 200 OK
    res.status(200).json(comments);
  } catch (err) {
    // DB 연결 문제 등 예기치 못한 서버 에러 처리
    res.status(500).json({ message: "Could not fetch comments" });
  }
});

// Get comments from post(id)
// post/:id/comments 
// router.get('/:id/comments', async (req: Request, res: Response) => {
//   const postId = parseInt(req.params.id, 10);

//   try {
//     const postComments = await prisma.comment.findMany({
//     where: {
//       postId: postId
//     },
//   })
//   res.status(201).json(postComments)
//   } catch (err) {
//     return res.status(404).json({ message : "post is not found"})
//   }
// });

// src/routes/posts.ts - POST /:id/comments

router.post('/:id/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
  const postId = parseInt(req.params.id, 10);
  const { text } = req.body;
  const authorId = req.user!.id; // 👈 이제 Body가 아닌 토큰에서 가져옵니다.

  // ... (유효성 검사) ...
  try {
    const newComment = await prisma.comment.create({
      data: {
        text,
        author: { connect: { id: authorId } },
        post: { connect: { id: postId } }
      },
      // 👇 생성된 댓글의 작성자 정보도 함께 반환하도록 include 추가
      include: {
        author: true
      }
    });
    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: 'Could not create comment' });
  }
})

export default router;