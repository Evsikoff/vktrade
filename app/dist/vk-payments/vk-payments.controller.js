"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VkPaymentsController = void 0;
const common_1 = require("@nestjs/common");
const vk_payments_service_1 = require("./vk-payments.service");
let VkPaymentsController = class VkPaymentsController {
    vkPaymentsService;
    constructor(vkPaymentsService) {
        this.vkPaymentsService = vkPaymentsService;
    }
    handlePostCallback(body) {
        const params = this.parseParams(body);
        return this.processCallback(params);
    }
    handleGetCallback(query, res) {
        try {
            return this.processCallback(query);
        }
        catch (e) {
            if (e.response && e.response.error_code) {
                res.setHeader('Invocation-error', e.response.error_code.toString());
                return e.response;
            }
            throw e;
        }
    }
    processCallback(params) {
        const method = params['method'];
        if (method === 'callbacks.payment') {
            return this.vkPaymentsService.handleOkPayment(params);
        }
        const notificationType = params['notification_type'];
        if (!notificationType) {
            throw new common_1.BadRequestException('notification_type is missing');
        }
        const isOk = params['site'] === 'OK';
        let result;
        if (notificationType === 'get_item' ||
            notificationType === 'get_item_test') {
            result = this.vkPaymentsService.handleGetItem(params);
        }
        else if (notificationType === 'order_status_change' ||
            notificationType === 'order_status_change_test') {
            result = this.vkPaymentsService.handleOrderStatusChange(params);
        }
        else {
            throw new common_1.BadRequestException(`Unknown notification_type: ${notificationType}`);
        }
        return isOk ? result : { response: result };
    }
    parseParams(body) {
        const result = {};
        if (!body)
            return result;
        for (const pair of body.split('&')) {
            const eqIndex = pair.indexOf('=');
            if (eqIndex === -1)
                continue;
            const key = decodeURIComponent(pair.slice(0, eqIndex));
            const value = decodeURIComponent(pair.slice(eqIndex + 1));
            result[key] = value;
        }
        return result;
    }
};
exports.VkPaymentsController = VkPaymentsController;
__decorate([
    (0, common_1.Post)('callback'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], VkPaymentsController.prototype, "handlePostCallback", null);
__decorate([
    (0, common_1.Get)('callback'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Object)
], VkPaymentsController.prototype, "handleGetCallback", null);
exports.VkPaymentsController = VkPaymentsController = __decorate([
    (0, common_1.Controller)('vk'),
    __metadata("design:paramtypes", [vk_payments_service_1.VkPaymentsService])
], VkPaymentsController);
//# sourceMappingURL=vk-payments.controller.js.map