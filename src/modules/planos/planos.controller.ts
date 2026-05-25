import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlanosService } from './planos.service';
import { IniciarUpgradeDto } from './dto/iniciar-upgrade.dto';

@ApiTags('planos')
@Controller('api/planos')
export class PlanosController {
  constructor(private readonly service: PlanosService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: 'Lista planos disponíveis + plano atual do profissional',
  })
  catalogo(@CurrentUser('id') userId: string | undefined) {
    if (!userId) throw new UnauthorizedException();
    return this.service.catalogo(userId);
  }

  @Post('upgrade')
  @ApiBearerAuth()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: 'Registra intenção de upgrade (stub — pagamento futuro)',
  })
  iniciarUpgrade(
    @CurrentUser('id') userId: string | undefined,
    @Body() dto: IniciarUpgradeDto,
  ) {
    if (!userId) throw new UnauthorizedException();
    return this.service.iniciarUpgrade(userId, dto.planoId);
  }
}
