-- CreateTable
CREATE TABLE "public"."Follows" (
    "followerId" INTEGER NOT NULL,
    "followedId" INTEGER NOT NULL,

    CONSTRAINT "Follows_pkey" PRIMARY KEY ("followerId","followedId")
);

-- AddForeignKey
ALTER TABLE "public"."Follows" ADD CONSTRAINT "Follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Follows" ADD CONSTRAINT "Follows_followedId_fkey" FOREIGN KEY ("followedId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
