import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookingService } from './booking.service';

@ApiTags('booking')
@Controller('api/booking')
export class BookingController {
  constructor(private readonly service: BookingService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Dados completos para página de booking público' })
  dadosBooking(@Param('slug') slug: string) {
    return this.service.dadosBookingPorSlug(slug);
  }
}
