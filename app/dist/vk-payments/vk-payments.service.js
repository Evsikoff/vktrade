"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VkPaymentsService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
let VkPaymentsService = class VkPaymentsService {
    itemsPath = path.resolve(process.cwd(), 'items.json');
    loadItems() {
        const raw = fs.readFileSync(this.itemsPath, 'utf-8');
        const data = JSON.parse(raw);
        return data.items;
    }
    handleGetItem(params) {
        const itemId = params['item'];
        if (!itemId) {
            throw new common_1.NotFoundException('item parameter is missing');
        }
        const items = this.loadItems();
        const found = items.find((i) => i.item_id === itemId);
        if (!found) {
            throw new common_1.NotFoundException(`Item "${itemId}" not found`);
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
    handleOrderStatusChange(params) {
        const orderId = params['order_id'];
        return {
            order_id: orderId ? parseInt(orderId, 10) : 0,
        };
    }
    handleOkPayment(params) {
        const secretKey = 'fQp4uFpv2BVYZt1shU3W';
        const sig = params['sig'];
        const calculatedSig = this.calculateOkSignature(params, secretKey);
        if (sig !== calculatedSig) {
            throw new common_1.BadRequestException({
                error_code: 104,
                error_msg: 'PARAM_SIGNATURE : Invalid signature. Expected ' + calculatedSig,
                error_data: null,
            });
        }
        const amount = params['amount'];
        const productCode = params['product_code'];
        if (!productCode || !amount) {
            throw new common_1.BadRequestException({
                error_code: 1001,
                error_msg: 'CALLBACK_INVALID_PAYMENT : Missing amount or product_code',
                error_data: null,
            });
        }
        const items = this.loadItems();
        const found = items.find((i) => i.item_id === productCode);
        if (!found) {
            throw new common_1.BadRequestException({
                error_code: 1001,
                error_msg: `CALLBACK_INVALID_PAYMENT : Item "${productCode}" not found`,
                error_data: null,
            });
        }
        return true;
    }
    calculateOkSignature(params, secretKey) {
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
};
exports.VkPaymentsService = VkPaymentsService;
exports.VkPaymentsService = VkPaymentsService = __decorate([
    (0, common_1.Injectable)()
], VkPaymentsService);
//# sourceMappingURL=vk-payments.service.js.map