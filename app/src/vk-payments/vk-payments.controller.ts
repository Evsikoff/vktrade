import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  BadRequestException,
  HttpCode,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { VkPaymentsService } from './vk-payments.service';

@Controller('vk')
export class VkPaymentsController {
  constructor(private readonly vkPaymentsService: VkPaymentsService) {}

  @Post('callback')
  @HttpCode(200)
  handlePostCallback(
    @Body() body: string,
    @Res({ passthrough: true }) res: Response,
  ): object {
    const params = this.parseParams(body);
    try {
      return this.processCallback(params);
    } catch (e: any) {
      if (params['site'] === 'OK' && e.response && e.response.error_code) {
        res.setHeader('Invocation-error', e.response.error_code.toString());
        return e.response;
      }
      throw e;
    }
  }

  @Get('callback')
  @HttpCode(200)
  handleGetCallback(
    @Query() query: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ): any {
    try {
      return this.processCallback(query);
    } catch (e: any) {
      if (e.response && e.response.error_code) {
        res.setHeader('Invocation-error', e.response.error_code.toString());
        return e.response;
      }
      throw e;
    }
  }

  private processCallback(params: Record<string, string>): any {
    const method = params['method'];
    if (method === 'callbacks.payment') {
      return this.vkPaymentsService.handleOkPayment(params);
    }

    const notificationType = params['notification_type'];
    if (!notificationType) {
      throw new BadRequestException('notification_type is missing');
    }

    const isOk = params['site'] === 'OK';
    let result: any;

    if (
      notificationType === 'get_item' ||
      notificationType === 'get_item_test' ||
      method === 'callbacks.getCustomProductInfo'
    ) {
      result = this.vkPaymentsService.handleGetItem(params);
    } else if (
      notificationType === 'order_status_change' ||
      notificationType === 'order_status_change_test'
    ) {
      result = this.vkPaymentsService.handleOrderStatusChange(params);
    } else {
      throw new BadRequestException(
        `Unknown notification_type: ${notificationType}`,
      );
    }

    // VK expects responses wrapped in "response" object, OK expects raw data
    return isOk ? result : { response: result };
  }

  private parseParams(body: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!body) return result;

    const params = new URLSearchParams(body);
    params.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }
}
