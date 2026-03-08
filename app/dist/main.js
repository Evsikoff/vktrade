"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((req, res, next) => {
        if (req.headers['content-type']?.includes('text/plain') ||
            req.headers['content-type']?.includes('application/x-www-form-urlencoded') ||
            !req.headers['content-type']) {
            let data = '';
            req.on('data', (chunk) => { data += chunk; });
            req.on('end', () => {
                req.body = data;
                next();
            });
        }
        else {
            next();
        }
    });
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
//# sourceMappingURL=main.js.map