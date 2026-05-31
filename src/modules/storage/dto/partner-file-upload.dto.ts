import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';

/** Partner-scoped upload purposes accepted by the server-side multipart upload. */
export const PARTNER_UPLOAD_PURPOSES = [
  'partner.profilePhoto',
  'partner.cnicFront',
  'partner.cnicBack',
  'partner.certificate',
] as const;
export type PartnerUploadPurpose = (typeof PARTNER_UPLOAD_PURPOSES)[number];

/**
 * Text fields of the `POST /uploads/partner-file` multipart request. The binary
 * `file` part is consumed by the FileInterceptor, not this DTO.
 */
export class PartnerFileUploadDto {
  @ApiProperty({ enum: PARTNER_UPLOAD_PURPOSES })
  @IsIn(PARTNER_UPLOAD_PURPOSES)
  purpose!: PartnerUploadPurpose;

  @ApiProperty({
    description: 'Id of the partner the file belongs to (or a draft id for a not-yet-created partner)',
  })
  @IsString()
  entityId!: string;
}

/** Body of `DELETE /uploads/partner-file`. */
export class DeletePartnerFileDto {
  @ApiProperty({ description: 'Storage key returned by the upload (must be a partner/* key)' })
  @IsString()
  @Matches(/^partner\//, { message: 'key must be a partner/* storage key' })
  key!: string;
}
