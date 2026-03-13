export declare class VkPaymentsService {
    private readonly itemsPath;
    private loadItems;
    handleGetItem(params: Record<string, string>): {
        title: string;
        price: number;
        photo_url: string;
        discount: number;
        item_id: string;
        expiration: number;
    };
    handleOrderStatusChange(params: Record<string, string>): {
        order_id: number;
    };
    handleOkPayment(params: Record<string, string>): boolean;
    private calculateOkSignature;
}
