-- Índice único parcial: no máximo 1 convite PENDING por pessoa + grupo.
-- O Prisma não expressa índice parcial no schema; por isso é SQL manual.
CREATE UNIQUE INDEX "group_invites_pending_unique"
  ON "group_invites"("group_id", "invited_user_id")
  WHERE "status" = 'PENDING';
