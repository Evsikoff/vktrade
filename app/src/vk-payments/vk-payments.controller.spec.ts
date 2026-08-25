import { Test, TestingModule } from '@nestjs/testing';
import { VkPaymentsController } from './vk-payments.controller';
import { VkPaymentsService } from './vk-payments.service';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Response } from 'express';

const VK_APP_ID = '54729341';
const VK_APP_SECRET = 'test-protected-key';

function paymentSignature(params: Record<string, string>): string {
  const source = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('');
  return crypto
    .createHash('md5')
    .update(source + VK_APP_SECRET)
    .digest('hex');
}

function signedLaunch(userId: string): Record<string, string> {
  const launch: Record<string, string> = {
    vk_app_id: VK_APP_ID,
    vk_user_id: userId,
    vk_language: 'ru',
  };
  const query = new URLSearchParams();
  Object.keys(launch)
    .sort()
    .forEach((key) => query.append(key, launch[key]));
  const sign = crypto
    .createHmac('sha256', VK_APP_SECRET)
    .update(query.toString())
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { ...launch, sign };
}

describe('VkPaymentsController', () => {
  let controller: VkPaymentsController;
  let ordersPath: string;

  beforeEach(async () => {
    ordersPath = path.join(
      os.tmpdir(),
      `vktrade-orders-${process.pid}-${Date.now()}-${Math.random()}.json`,
    );
    process.env.VK_ORDERS_FILE = ordersPath;
    process.env[`VK_APP_SECRET_${VK_APP_ID}`] = VK_APP_SECRET;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VkPaymentsController],
      providers: [VkPaymentsService],
    }).compile();

    controller = module.get<VkPaymentsController>(VkPaymentsController);
  });

  afterEach(() => {
    delete process.env.VK_ORDERS_FILE;
    delete process.env[`VK_APP_SECRET_${VK_APP_ID}`];
    try {
      fs.unlinkSync(ordersPath);
    } catch {
      // A read-only test does not create the ledger.
    }
  });

  it('should handle VK get_item', () => {
    const result = controller.handlePostCallback(
      'notification_type=get_item&item=energy_pack_100',
    );
    expect(result).toHaveProperty('response');
    expect(result['response']).toHaveProperty('item_id', 'energy_pack_100');
  });

  it('should handle OK get_item', () => {
    const result = controller.handlePostCallback(
      'notification_type=get_item&item=energy_pack_100&site=OK',
    );
    expect(result).not.toHaveProperty('response');
    expect(result).toHaveProperty('name', '100 единиц энергии');
    expect(result).toHaveProperty('code', 'energy_pack_100');
    expect(result).toHaveProperty('imageUrl');
  });

  it('should correctly decode parameters with plus signs as spaces', () => {
    // URLSearchParams (which we now use) should handle + as space
    const result = controller.handlePostCallback(
      'notification_type=get_item&item=energy_pack_100&site=OK&method=callbacks.getCustomProductInfo',
      { setHeader: jest.fn() } as unknown as Response,
    );
    expect(result).toHaveProperty('name', '100 единиц энергии');
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
    const sig = crypto
      .createHash('md5')
      .update(str)
      .digest('hex')
      .toLowerCase();

    const query = { ...params, sig };
    const result = controller.handleGetCallback(query, {
      setHeader: jest.fn(),
    } as unknown as Response);
    expect(result).toBe(true);
  });

  it('should fail OK payment with invalid signature', () => {
    const query = {
      method: 'callbacks.payment',
      amount: '8',
      product_code: 'energy_pack_100',
      sig: 'wrong_sig',
    };

    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const result = controller.handleGetCallback(query, res);

    expect(setHeader).toHaveBeenCalledWith('Invocation-error', '104');
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
    const sig = crypto
      .createHash('md5')
      .update(str)
      .digest('hex')
      .toLowerCase();

    const query = { ...params, sig };
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const result = controller.handleGetCallback(query, res);

    expect(setHeader).toHaveBeenCalledWith('Invocation-error', '1001');
    expect(result).toHaveProperty('error_code', 1001);
  });

  it('records a signed VK order and returns it from /vk/verify', () => {
    const params: Record<string, string> = {
      notification_type: 'order_status_change_test',
      app_id: VK_APP_ID,
      user_id: '494075',
      item: 'ants_lives_refill',
      item_price: '1',
      order_id: '1001',
      status: 'chargeable',
    };
    const body = new URLSearchParams({
      ...params,
      sig: paymentSignature(params),
    }).toString();

    const callback = controller.handlePostCallback(body, {
      setHeader: jest.fn(),
    } as unknown as Response);
    expect(callback).toEqual({
      response: { order_id: 1001, app_order_id: 1001 },
    });

    const verified = controller.verifyOrder({
      item: 'ants_lives_refill',
      launch: signedLaunch('494075'),
    });
    expect(verified.granted).toBe(true);
    expect(verified.orders).toEqual([
      expect.objectContaining({
        order_id: '1001',
        item: 'ants_lives_refill',
        status: 'confirmed',
      }),
    ]);
  });

  it('keeps legacy VK products working when their secret is not configured', () => {
    const body = new URLSearchParams({
      notification_type: 'order_status_change',
      app_id: '54475142',
      user_id: '42',
      item: 'energy_pack_100',
      order_id: '3001',
      status: 'chargeable',
    }).toString();

    expect(
      controller.handlePostCallback(body, {
        setHeader: jest.fn(),
      } as unknown as Response),
    ).toEqual({ response: { order_id: 3001, app_order_id: 3001 } });
  });

  it('rejects /vk/verify when the launch signature is invalid', () => {
    expect(() =>
      controller.verifyOrder({
        item: 'ants_lives_refill',
        launch: {
          ...signedLaunch('494075'),
          sign: 'invalid',
        },
      }),
    ).toThrow(BadRequestException);
  });
});
