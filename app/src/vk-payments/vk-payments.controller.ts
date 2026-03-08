import {
  Controller,
  Post,
  Body,
  BadRequestException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { VkPaymentsService } from './vk-payments.service';

@Controller('vk')
export class VkPaymentsController {
  constructor(private readonly vkPaymentsService: VkPaymentsService) {}

  @Post('callback')
  handleCallback(@Body() body: string): object {
    // body is a raw URL-encoded string, e.g. "app_id=123&item=sale_item_1&..."
    const params = this.parseParams(body);
    const notificationType = params['notification_type'];

    if (!notificationType) {
      throw new BadRequestException('notification_type is missing');
    }

    if (
      notificationType === 'get_item' ||
      notificationType === 'get_item_test'
    ) {
      return this.vkPaymentsService.handleGetItem(params);
    }

    if (
      notificationType === 'order_status_change' ||
      notificationType === 'order_status_change_test'
    ) {
      return this.vkPaymentsService.handleOrderStatusChange(params);
    }

    throw new BadRequestException(
      `Unknown notification_type: ${notificationType}`,
    );
  }

  private parseParams(body: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!body) return result;

    for (const pair of body.split('&')) {
      const eqIndex = pair.indexOf('=');
      if (eqIndex === -1) continue;
      const key = decodeURIComponent(pair.slice(0, eqIndex));
      const value = decodeURIComponent(pair.slice(eqIndex + 1));
      result[key] = value;
    }

    return result;
  }
}
