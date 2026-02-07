import { Controller, Get, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { join } from 'path';

/**
 * SPA Fallback Controller
 * Serves index.html for all routes not handled by API or static files
 * This enables client-side routing in the React frontend
 */
@Controller()
export class SpaFallbackController {
  @Get('*')
  serveIndex(@Req() req: Request, @Res() res: Response) {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ message: 'Not Found' });
    }
    
    // Serve the SPA index.html for all other routes
    const indexPath = join(__dirname, '..', '..', 'client', 'index.html');
    return res.sendFile(indexPath);
  }
}
