import { INestApplicationContext } from '@nestjs/common';

/**
 * Holds a static reference to the NestJS application instance.
 * This is a workaround for scenarios where the app context is needed
 * in places not easily reachable by standard DI, such as tool factories
 * used by services that are themselves part of the DI.
 *
 * Ensure `setAppInstance` is called in `main.ts` after app creation
 * and before any service that relies on `AppInstance` is resolved.
 */
export let AppInstance: INestApplicationContext = null;

export const setAppInstance = (app: INestApplicationContext): void => {
  if (AppInstance) {
    // Optional: Log a warning if it's being set multiple times,
    // though in a standard NestJS app, main.ts runs once.
    console.warn(
      'AppInstance is being overwritten. This should ideally happen only once.',
    );
  }
  AppInstance = app;
};
