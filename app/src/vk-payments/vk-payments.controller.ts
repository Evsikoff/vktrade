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
import {
  VkPaymentsService,
  type VerifyRequest,
  type VerifyResponse,
} from './vk-payments.service';

type CallbackResult = object | boolean;
type InvocationError = Record<string, unknown> & {
  error_code: string | number;
};

function invocationError(error: unknown): InvocationError | null {
  if (!error || typeof error !== 'object' || !('response' in error))
    return null;
  const response = (error as { response?: unknown }).response;
  if (
    !response ||
    typeof response !== 'object' ||
    !('error_code' in response)
  ) {
    return null;
  }
  const code = (response as { error_code?: unknown }).error_code;
  return typeof code === 'string' || typeof code === 'number'
    ? (response as InvocationError)
    : null;
}

@Controller('vk')
export class VkPaymentsController {
  constructor(private readonly vkPaymentsService: VkPaymentsService) {}

  @Post('verify')
  @HttpCode(200)
  verifyOrder(@Body() body: VerifyRequest): VerifyResponse {
    return this.vkPaymentsService.handleVerify(body);
  }

  @Post('callback')
  @HttpCode(200)
  handlePostCallback(
    @Body() body: string,
    @Res({ passthrough: true }) res: Response,
  ): CallbackResult {
    const params = this.parseParams(body);
    try {
      return this.processCallback(params);
    } catch (error: unknown) {
      const response = invocationError(error);
      if (params['site'] === 'OK' && response) {
        res.setHeader('Invocation-error', String(response.error_code));
        return response;
      }
      throw error;
    }
  }

  @Get('callback')
  @HttpCode(200)
  handleGetCallback(
    @Query() query: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ): CallbackResult {
    try {
      return this.processCallback(query);
    } catch (error: unknown) {
      const response = invocationError(error);
      if (response) {
        res.setHeader('Invocation-error', String(response.error_code));
        return response;
      }
      throw error;
    }
  }

  private processCallback(params: Record<string, string>): CallbackResult {
    const method = params['method'];
    if (method === 'callbacks.payment') {
      return this.vkPaymentsService.handleOkPayment(params);
    }

    const notificationType = params['notification_type'];
    if (!notificationType) {
      throw new BadRequestException('notification_type is missing');
    }

    const isOk = params['site'] === 'OK';
    let result: object;

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
