import { Module } from '@nestjs/common';
import { VkPaymentsModule } from './vk-payments/vk-payments.module';

@Module({
  imports: [VkPaymentsModule],
})
export class AppModule {}
