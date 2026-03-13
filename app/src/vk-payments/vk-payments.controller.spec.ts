import { Test, TestingModule } from '@nestjs/testing';
import { VkPaymentsController } from './vk-payments.controller';
import { VkPaymentsService } from './vk-payments.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('VkPaymentsController', () => {
  let controller: VkPaymentsController;
  let service: VkPaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VkPaymentsController],
      providers: [VkPaymentsService],
    }).compile();

    controller = module.get<VkPaymentsController>(VkPaymentsController);
    service = module.get<VkPaymentsService>(VkPaymentsService);
  });

  it('should handle VK get_item', () => {
    const result = controller.handlePostCallback('notification_type=get_item&item=energy_pack_100');
    expect(result).toHaveProperty('response');
    expect(result['response']).toHaveProperty('item_id', 'energy_pack_100');
  });

  it('should handle OK get_item', () => {
    const result = controller.handlePostCallback('notification_type=get_item&item=energy_pack_100&site=OK');
    expect(result).not.toHaveProperty('response');
    expect(result).toHaveProperty('item_id', 'energy_pack_100');
  });

  it('should handle OK payment with valid signature', () => {
    const secretKey = 'fQp4uFpv2BVYZt1shU3W';
    const params = {
      method: 'callbacks.payment',
      amount: '8',
      product_code: 'energy_pack_100',
      transaction_id: '123',
    };

    const keys = Object.keys(params).sort();
    let str = '';
    for (const key of keys) {
      str += `${key}=${params[key]}`;
    }
    str += secretKey;
    const sig = crypto.createHash('md5').update(str).digest('hex').toLowerCase();

    const query = { ...params, sig };
    const result = controller.handleGetCallback(query, { setHeader: jest.fn() } as any);
    expect(result).toBe(true);
  });

  it('should fail OK payment with invalid signature', () => {
    const query = {
      method: 'callbacks.payment',
      amount: '8',
      product_code: 'energy_pack_100',
      sig: 'wrong_sig',
    };

    const res = { setHeader: jest.fn() } as any;
    const result = controller.handleGetCallback(query, res);

    expect(res.setHeader).toHaveBeenCalledWith('Invocation-error', '104');
    expect(result).toHaveProperty('error_code', 104);
  });

  it('should fail OK payment with missing item', () => {
    const secretKey = 'fQp4uFpv2BVYZt1shU3W';
    const params = {
      method: 'callbacks.payment',
      amount: '8',
      product_code: 'non_existent_item',
    };

    const keys = Object.keys(params).sort();
    let str = '';
    for (const key of keys) {
      str += `${key}=${params[key]}`;
    }
    str += secretKey;
    const sig = crypto.createHash('md5')
      .update(str)
      .digest('hex')
      .toLowerCase();

    const query = { ...params, sig };
    const res = { setHeader: jest.fn() } as any;
    const result = controller.handleGetCallback(query, res);

    expect(res.setHeader).toHaveBeenCalledWith('Invocation-error', '1001');
    expect(result).toHaveProperty('error_code', 1001);
  });
});
