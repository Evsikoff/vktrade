import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface VkItem {
  id: number;
  app_id: number;
  title: string;
  price: number;
  photo_url: string;
  discount: number;
  item_id: string;
  expiration: number;
}

interface ItemsData {
  items: VkItem[];
}

interface VkOrder {
  order_id: string;
  app_id: string;
  user_id: string;
  item: string;
  status: 'confirmed' | 'refunded';
  at: number;
  refunded_at?: number;
  test: boolean;
}

interface OrdersData {
  orders: Record<string, VkOrder>;
}

export interface VerifyRequest {
  item?: string;
  launch?: Record<string, string | number | boolean>;
}

export interface VerifyResponse {
  granted: boolean;
  status: 'confirmed' | 'pending';
  orders: Array<{
    order_id: string;
    item: string;
    status: 'confirmed' | 'refunded';
    at: number;
    refunded_at: number;
  }>;
  server_time: number;
}

@Injectable()
export class VkPaymentsService {
  private readonly itemsPath =
    process.env.VK_ITEMS_FILE ||
    [
      path.resolve(process.cwd(), 'items.json'),
      path.resolve(process.cwd(), '..', 'items.json'),
    ].find((candidate) => fs.existsSync(candidate)) ||
    path.resolve(process.cwd(), 'items.json');
  private readonly ordersPath =
    process.env.VK_ORDERS_FILE || path.resolve(process.cwd(), 'vk-orders.json');
  private readonly orders: OrdersData = this.loadOrders();

  private loadItems(): VkItem[] {
    const raw = fs.readFileSync(this.itemsPath, 'utf-8');
    // JSON.parse is typed as `any`; items.json is deployment-owned configuration.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data: ItemsData = JSON.parse(raw);
    return data.items;
  }

  private findItem(itemId: string): VkItem {
    const found = this.loadItems().find((item) => item.item_id === itemId);
    if (!found) {
      throw new NotFoundException(`Item "${itemId}" not found`);
    }
    return found;
  }

  private loadOrders(): OrdersData {
    try {
      const parsed: unknown = JSON.parse(
        fs.readFileSync(this.ordersPath, 'utf-8'),
      );
      if (parsed && typeof parsed === 'object' && 'orders' in parsed) {
        const orders = (parsed as { orders?: unknown }).orders;
        if (orders && typeof orders === 'object') {
          return { orders: orders as Record<string, VkOrder> };
        }
      }
    } catch {
      // First start: the ledger is created after the first confirmed order.
    }
    return { orders: {} };
  }

  private saveOrders(): void {
    fs.mkdirSync(path.dirname(this.ordersPath), { recursive: true });
    const tmp = `${this.ordersPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.orders, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    try {
      fs.renameSync(tmp, this.ordersPath);
    } catch (error) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        // Preserve the original storage error.
      }
      throw error;
    }
  }

  private configuredAppSecret(appId: string): string | undefined {
    const scoped = process.env[`VK_APP_SECRET_${appId}`];
    if (scoped) return scoped;

    const secretsJson = process.env.VK_APP_SECRETS;
    if (secretsJson) {
      try {
        const secrets = JSON.parse(secretsJson) as Record<string, unknown>;
        const secret = secrets[appId];
        if (typeof secret === 'string' && secret) return secret;
      } catch {
        throw new ServiceUnavailableException(
          'VK_APP_SECRETS contains invalid JSON',
        );
      }
    }

    if (
      process.env.VK_APP_SECRET &&
      String(process.env.VK_APP_ID || '') === appId
    ) {
      return process.env.VK_APP_SECRET;
    }

    return undefined;
  }

  private appSecret(appId: string): string {
    const secret = this.configuredAppSecret(appId);
    if (secret) return secret;
    throw new ServiceUnavailableException(
      `Protected key is not configured for VK app ${appId}`,
    );
  }

  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  private assertCallbackSignature(
    params: Record<string, string>,
    secret: string,
  ): void {
    const received = String(params['sig'] || '').toLowerCase();
    const unsigned = Object.keys(params)
      .filter((key) => key !== 'sig')
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('');
    const expected = crypto
      .createHash('md5')
      .update(unsigned + secret, 'utf-8')
      .digest('hex');
    if (!received || !this.safeEqual(expected, received)) {
      throw new BadRequestException('Invalid VK payment signature');
    }
  }

  private assertLaunchSignature(
    launch: Record<string, string | number | boolean>,
    appId: string,
  ): void {
    const received = String(launch['sign'] || '');
    const query = new URLSearchParams();
    Object.keys(launch)
      .filter((key) => key.startsWith('vk_'))
      .sort()
      .forEach((key) => query.append(key, String(launch[key])));
    const expected = crypto
      .createHmac('sha256', this.appSecret(appId))
      .update(query.toString())
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    if (!received || !this.safeEqual(expected, received)) {
      throw new BadRequestException('Invalid VK launch signature');
    }
  }

  handleGetItem(params: Record<string, string>) {
    const itemId = params['item'];
    if (!itemId) {
      throw new NotFoundException('item parameter is missing');
    }

    const found = this.findItem(itemId);

    if (params['site'] === 'OK') {
      return {
        name: found.title,
        description: found.title,
        price: found.price,
        code: found.item_id,
        imageUrl: found.photo_url,
      };
    }

    return {
      title: found.title,
      price: found.price,
      photo_url: found.photo_url,
      discount: found.discount,
      item_id: found.item_id,
      expiration: found.expiration,
    };
  }

  handleOrderStatusChange(params: Record<string, string>) {
    const orderId = String(params['order_id'] || '');
    const userId = String(params['user_id'] || '');
    const itemId = String(params['item'] || '');
    const status = String(params['status'] || '');
    if (!orderId || !userId || !itemId) {
      throw new BadRequestException('order_id, user_id and item are required');
    }

    const item = this.findItem(itemId);
    const appId = String(params['app_id'] || item.app_id);
    if (appId !== String(item.app_id)) {
      throw new BadRequestException('Item does not belong to this VK app');
    }
    const secret = this.configuredAppSecret(appId);
    if (!secret) {
      // Keep legacy products working until their protected key is configured. Such
      // callbacks receive the historical acknowledgement but are deliberately not
      // exposed through /vk/verify and cannot grant a client entitlement.
      return {
        order_id: parseInt(orderId, 10),
        app_order_id: parseInt(orderId, 10),
      };
    }
    this.assertCallbackSignature(params, secret);

    const isTest = String(params['notification_type'] || '').endsWith('_test');
    if (isTest && process.env.VK_ALLOW_TEST === '0') {
      throw new BadRequestException('VK test payments are disabled');
    }

    const orderKey = `${appId}:${orderId}`;
    const existing = this.orders.orders[orderKey];
    if (existing) {
      if (
        existing.app_id !== appId ||
        existing.user_id !== userId ||
        existing.item !== itemId
      ) {
        throw new BadRequestException(
          'order_id conflicts with an existing order',
        );
      }
      if (status === 'refunded' && existing.status !== 'refunded') {
        existing.status = 'refunded';
        existing.refunded_at = Date.now();
        this.saveOrders();
      }
      return {
        order_id: parseInt(orderId, 10),
        app_order_id: parseInt(orderId, 10),
      };
    }

    if (status !== 'chargeable') {
      throw new BadRequestException(`Unsupported order status: ${status}`);
    }

    this.orders.orders[orderKey] = {
      order_id: orderId,
      app_id: appId,
      user_id: userId,
      item: itemId,
      status: 'confirmed',
      at: Date.now(),
      test: isTest,
    };
    try {
      this.saveOrders();
    } catch (error) {
      delete this.orders.orders[orderKey];
      throw error;
    }

    return {
      order_id: parseInt(orderId, 10),
      app_order_id: parseInt(orderId, 10),
    };
  }

  handleVerify(payload: VerifyRequest): VerifyResponse {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid request body');
    }
    const itemId = String(payload.item || '');
    const launch = payload.launch;
    if (!itemId || !launch || typeof launch !== 'object') {
      throw new BadRequestException('item and launch are required');
    }

    const item = this.findItem(itemId);
    const appId = String(launch['vk_app_id'] || '');
    const userId = String(launch['vk_user_id'] || '');
    if (!appId || !userId) {
      throw new BadRequestException('vk_app_id and vk_user_id are required');
    }
    if (appId !== String(item.app_id)) {
      throw new BadRequestException('Item does not belong to this VK app');
    }
    this.assertLaunchSignature(launch, appId);

    const orders = Object.values(this.orders.orders)
      .filter((order) => order.app_id === appId && order.user_id === userId)
      .map((order) => ({
        order_id: order.order_id,
        item: order.item,
        status: order.status,
        at: order.at,
        refunded_at: order.refunded_at || 0,
      }))
      .sort(
        (a, b) =>
          a.at - b.at || String(a.order_id).localeCompare(String(b.order_id)),
      );
    const granted = orders.some(
      (order) => order.item === itemId && order.status === 'confirmed',
    );

    return {
      granted,
      status: granted ? 'confirmed' : 'pending',
      orders,
      server_time: Date.now(),
    };
  }

  handleOkPayment(params: Record<string, string>) {
    const secretKey = 'fQp4uFpv2BVYZt1shU3W';

    const sig = params['sig'];
    const calculatedSig = this.calculateOkSignature(params, secretKey);

    if (sig !== calculatedSig) {
      throw new BadRequestException({
        error_code: 104,
        error_msg:
          'PARAM_SIGNATURE : Invalid signature. Expected ' + calculatedSig,
        error_data: null,
      });
    }

    const amount = params['amount'];
    const productCode = params['product_code'];

    if (!productCode || !amount) {
      throw new BadRequestException({
        error_code: 1001,
        error_msg: 'CALLBACK_INVALID_PAYMENT : Missing amount or product_code',
        error_data: null,
      });
    }

    const found = this.loadItems().find((item) => item.item_id === productCode);
    if (!found) {
      throw new BadRequestException({
        error_code: 1001,
        error_msg: `CALLBACK_INVALID_PAYMENT : Item "${productCode}" not found`,
        error_data: null,
      });
    }
    return true;
  }

  private calculateOkSignature(
    params: Record<string, string>,
    secretKey: string,
  ): string {
    const keys = Object.keys(params)
      .filter((k) => k !== 'sig')
      .sort();
    let str = '';
    for (const key of keys) {
      str += `${key}=${params[key]}`;
    }
    str += secretKey;
    return crypto.createHash('md5').update(str).digest('hex').toLowerCase();
  }
}
