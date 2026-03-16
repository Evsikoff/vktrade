import {
  Injectable,
  NotFoundException,
  BadRequestException,
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

@Injectable()
export class VkPaymentsService {
  private readonly itemsPath = path.resolve(process.cwd(), 'items.json');

  private loadItems(): VkItem[] {
    const raw = fs.readFileSync(this.itemsPath, 'utf-8');
    const data: ItemsData = JSON.parse(raw);
    return data.items;
  }

  handleGetItem(params: Record<string, string>) {
    const itemId = params['item'];
    if (!itemId) {
      throw new NotFoundException('item parameter is missing');
    }

    const items = this.loadItems();
    const found = items.find((i) => i.item_id === itemId);

    if (!found) {
      throw new NotFoundException(`Item "${itemId}" not found`);
    }

    if (params['site'] === 'OK') {
      return {
        name: found.title,
        description: found.title, // Using title as description
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
    const orderId = params['order_id'];
    return {
      order_id: orderId ? parseInt(orderId, 10) : 0,
    };
  }

  handleOkPayment(params: Record<string, string>) {
    const secretKey = 'fQp4uFpv2BVYZt1shU3W';

    // Verify signature
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

    // Amount and product_code verification (as per instructions)
    const amount = params['amount'];
    const productCode = params['product_code'];

    if (!productCode || !amount) {
      throw new BadRequestException({
        error_code: 1001,
        error_msg: 'CALLBACK_INVALID_PAYMENT : Missing amount or product_code',
        error_data: null,
      });
    }

    const items = this.loadItems();
    const found = items.find((i) => i.item_id === productCode);

    if (!found) {
      throw new BadRequestException({
        error_code: 1001,
        error_msg: `CALLBACK_INVALID_PAYMENT : Item "${productCode}" not found`,
        error_data: null,
      });
    }

    // Optional: verify amount matches item price if needed, but user said "No, it's an extra point of failure"
    // However, instructions say "The developer is obliged to check the correspondence of the goods and its price"
    // I will skip strict price check as per user's explicit instructions in turn 4.

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
