import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setAppInstance } from './app.instance';
import { VersioningType, Logger } from '@nestjs/common'; // Added Logger
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'; // Added Swagger
import * as cookieParser from 'cookie-parser'; // Added cookieParser
import { ZodValidationPipe } from 'nestjs-zod'; // Added ZodValidationPipe
import { ZodValidationExceptionFilter } from './common/filters/zod-validation-exception.filter';
// import { VoltAgent } from '@voltagent/core';
// import { SupervisorAgentService } from './modules/agents/agents/supervisor/supervisor.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setAppInstance(app); // Set the global app instance

  app.use(cookieParser()); // Use cookie-parser middleware
  app.enableCors(); // Enable CORS
  app.useGlobalPipes(new ZodValidationPipe()); // Use ZodValidationPipe globally
  app.useGlobalFilters(new ZodValidationExceptionFilter()); // Catch Zod validation errors

  // // Get agent service instances from the NestJS application context
  // const supervisorAgent = app.get(SupervisorAgentService);

  // // Initialize VoltAgent with the registered agent(s)
  // // Both agents need to be explicitly registered here if AgentEventEmitter looks them up by ID
  // // from the top-level agents map of VoltAgent.
  // new VoltAgent({
  //   autoStart: true,
  //   agents: {
  //     supervisor: supervisorAgent, // Key 'supervisor' matches supervisorAgent.id
  //   },
  // });

  app.setGlobalPrefix('api'); // Set a global prefix for all routes
  app.enableVersioning({
    type: VersioningType.URI, // Use URI versioning
    defaultVersion: '1', // Default version
    prefix: 'v', // Prefix for versioning
  });

  // Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('The API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('api/docs', app as any, document); // Swagger UI available at /api/docs

  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
  Logger.log(
    `📚 Swagger documentation is available on: http://localhost:${port}/api/docs`,
  );
}
bootstrap();
