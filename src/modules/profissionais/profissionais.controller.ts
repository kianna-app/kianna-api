import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProfissionaisService } from './profissionais.service';

@ApiTags('profissionais')
@Controller('api/profissionais')
export class ProfissionaisController {
  constructor(private readonly service: ProfissionaisService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Dados do profissional logado' })
  me(@CurrentUser('id') userId: string) {
    return this.service.porUserId(userId);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Dados públicos do profissional por slug' })
  porSlug(@Param('slug') slug: string) {
    return this.service.porSlug(slug);
  }
}
