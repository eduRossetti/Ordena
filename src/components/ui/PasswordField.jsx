'use client';

import { EyeClosedIcon, EyeIcon } from '@primer/octicons-react';
import { TextInput } from '@primer/react';
import { useState } from 'react';
import FormField from '@/components/ui/FormField';

export default function PasswordField(props) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailingAction={
        <TextInput.Action
          onClick={() => setVisible((current) => !current)}
          icon={visible ? EyeClosedIcon : EyeIcon}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        />
      }
    />
  );
}
