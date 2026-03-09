import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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

    const itemData = {
      title: found.title,
      price: found.price,
      photo_url: found.photo_url,
      discount: found.discount,
      item_id: found.item_id,
      expiration: found.expiration,
    };

    if (params['site'] === 'OK') {
      return itemData;
    }

    return { response: itemData };
  }

  handleOrderStatusChange(params: Record<string, string>) {
    const orderId = params['order_id'];
    return {
      response: {
        order_id: orderId ? parseInt(orderId, 10) : 0,
      },
    };
  }
}
