import type { Response } from 'express';
import { VkPaymentsService } from './vk-payments.service';
export declare class VkPaymentsController {
    private readonly vkPaymentsService;
    constructor(vkPaymentsService: VkPaymentsService);
    handlePostCallback(body: string): object;
    handleGetCallback(query: Record<string, string>, res: Response): any;
    private processCallback;
    private parseParams;
}
