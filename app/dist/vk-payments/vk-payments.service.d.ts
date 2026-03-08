export declare class VkPaymentsService {
    private readonly itemsPath;
    private loadItems;
    handleGetItem(params: Record<string, string>): {
        response: {
            title: string;
            price: number;
            photo_url: string;
            discount: number;
            item_id: string;
            expiration: number;
        };
    };
    handleOrderStatusChange(params: Record<string, string>): {
        response: {
            order_id: number;
        };
    };
}
