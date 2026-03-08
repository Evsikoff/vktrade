import { Module } from '@nestjs/common';
import { VkPaymentsController } from './vk-payments.controller';
import { VkPaymentsService } from './vk-payments.service';

@Module({
  controllers: [VkPaymentsController],
  providers: [VkPaymentsService],
})
export class VkPaymentsModule {}
