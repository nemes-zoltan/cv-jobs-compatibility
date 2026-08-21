'use client'

import * as React from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@cv-jobs-compatibility/components'
import { cn } from '@/lib/utils'

/**
 * `InputGroup` already handles the border, focus ring and invalid states for a
 * control with an adornment, so this only adds the reveal toggle on top.
 */
export function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof InputGroupInput>) {
  const [visible, setVisible] = React.useState(false)

  return (
    <InputGroup className={cn('h-10', className)}>
      <InputGroupInput type={visible ? 'text' : 'password'} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-sm"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
