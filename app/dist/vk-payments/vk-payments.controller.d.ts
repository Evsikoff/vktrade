import { VkPaymentsService } from './vk-payments.service';
export declare class VkPaymentsController {
    private readonly vkPaymentsService;
    constructor(vkPaymentsService: VkPaymentsService);
    handleCallback(body: string): object;
    private parseParams;
}
