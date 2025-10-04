// src/routes/comments.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import authMiddleware, { AuthRequest } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// [U] Update a Comment
router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const commentId = parseInt(req.params.id, 10);
  const { text } = req.body;
  const userId = req.user!.id;

  try {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.authorId !== userId) return res.status(403).json({ message: 'Forbidden' });

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { text },
    });
    res.status(200).json(updatedComment);
  } catch (error) {
    res.status(500).json({ message: 'Error updating comment' });
  }
});

// [D] Delete a Comment
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const commentId = parseInt(req.params.id, 10);
  const userId = req.user!.id;

  try {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.authorId !== userId) return res.status(403).json({ message: 'Forbidden' });

    await prisma.comment.delete({ where: { id: commentId } });
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting comment' });
  }
});

export default router;