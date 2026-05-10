import { Module } from '@nestjs/common';
import { ArticleStorageService } from './article-storage.service';
import { PrismaModule } from '@server/prisma/prisma.module';
import { TrpcModule } from '@server/trpc/trpc.module';

@Module({
  imports: [PrismaModule, TrpcModule],
  providers: [ArticleStorageService],
  exports: [ArticleStorageService],
})
export class StorageModule {}
