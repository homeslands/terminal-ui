import React from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Input,
  Form,
  Button,
  Textarea,
  Label,
  Switch,
} from '@/components/ui'
import { IsComboSwitch, IsCustomPriceSwitch, IsGiftSwitch } from '@/components/app/switch'
import { createProductSchema, TCreateProductSchema } from '@/schemas'

import { zodResolver } from '@hookform/resolvers/zod'
import { ICreateProductRequest } from '@/types'
import { useCreateProduct } from '@/hooks'
import { showToast } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'
import { CatalogSelect } from '@/components/app/select'

interface IFormCreateProductProps {
  onSubmit: (isOpen: boolean) => void
}

export const CreateProductForm: React.FC<IFormCreateProductProps> = ({
  onSubmit,
}) => {
  const queryClient = useQueryClient()
  const { t } = useTranslation(['product'])
  const { mutate: createProduct } = useCreateProduct()
  const form = useForm<TCreateProductSchema>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: '',
      description: '',
      isLimit: false,
      isTopSell: false,
      isNew: false,
      isCombo: false,
      isGift: false,
      isCustomPrice: false,
      catalog: '',
      vatRate: 0,
    },
  })

  const handleSubmit = (data: ICreateProductRequest, shouldCloseForm: boolean) => {
    createProduct(data, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['products'],
        })
        if (shouldCloseForm) {
          onSubmit(false); // Đóng form nếu cần
        }
        form.reset({
          name: '',
          description: '',
          isLimit: false,
          isTopSell: false,
          isNew: false,
          isGift: false,
          isCombo: false,
          isCustomPrice: false,
          vatRate: 0,
        })
        showToast(t('toast.createProductSuccess'))
      },
    })
  }

  const formFields = {
    name: (
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('product.productName')}</FormLabel>
            <FormControl>
              <Input {...field} placeholder={t('product.enterProductName')} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    description: (
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('product.productDescription')}</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder={t('product.enterProductDescription')}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    switch: (
      <div className='grid grid-cols-1 gap-2 justify-between sm:grid-cols-2'>
        <FormField
          control={form.control}
          name="isLimit"
          render={({ field }) => (
            <FormItem className="flex gap-4 items-center">
              <FormControl className="flex items-center p-0 w-full">
                {/* <IsLimitSwitch {...field} /> */}
                <div className="flex gap-4 justify-between items-center py-2 w-full">
                  <Label>{t('product.isLimited')}</Label>
                  <Switch checked={field.value}
                    onCheckedChange={field.onChange} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isTopSell"
          render={({ field }) => (
            <FormItem className="flex gap-4 items-center">
              <FormControl className="flex items-center p-0 w-full">
                <div className="flex gap-4 justify-between items-center py-2 w-full">
                  <Label>{t('product.isTopSell')}</Label>
                  <Switch checked={field.value}
                    onCheckedChange={field.onChange} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isNew"
          render={({ field }) => (
            <FormItem className="flex items-center">
              <FormControl className="flex items-center p-0 w-full">
                <div className="flex gap-4 justify-between items-center py-2 w-full">
                  <Label>{t('product.isNew')}</Label>
                  <Switch checked={field.value}
                    onCheckedChange={field.onChange} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isCombo"
          render={({ field }) => (
            <FormItem className="flex items-center">
              <FormControl className="flex items-center p-0 w-full">
                <div className="flex gap-4 justify-between items-center w-full">
                  <IsComboSwitch
                    defaultValue={field.value}
                    onChange={field.onChange}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isGift"
          render={({ field }) => (
            <FormItem className="flex items-center">
              <FormControl className="flex items-center p-0 w-full">
                <div className="flex gap-4 justify-between items-center w-full">
                  <IsGiftSwitch
                    defaultValue={field.value}
                    onChange={field.onChange}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isCustomPrice"
          render={({ field }) => (
            <FormItem className="flex items-center">
              <FormControl className="flex items-center p-0 w-full">
                <div className="flex gap-4 justify-between items-center w-full">
                  <IsCustomPriceSwitch
                    defaultValue={field.value}
                    onChange={field.onChange}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    ),
    catalog: (
      <FormField
        control={form.control}
        name="catalog"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('product.productCatalog')}</FormLabel>
            <FormControl>
              <CatalogSelect {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
    vatRate: (
      <FormField
        control={form.control}
        name="vatRate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Thuế VAT (%)</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  placeholder="VD: 5.75 hoặc 10"
                  {...field}
                  value={field.value === 0 ? '' : field.value}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      field.onChange('')
                    } else {
                      field.onChange(Number(value))
                    }
                  }}
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    ),
  }

  return (
    <div className="mt-3">
      <Form {...form}>
        <form className="space-y-6">
          <div className="grid grid-cols-1 gap-2">
            {Object.keys(formFields).map((key) => (
              <React.Fragment key={key}>
                {formFields[key as keyof typeof formFields]}
              </React.Fragment>
            ))}
          </div>
          <div className="flex gap-4 justify-end">
            <Button
              type="submit"
              variant="outline"
              onClick={form.handleSubmit((data) => handleSubmit(data, false))}
              className="border-pos-gold text-pos-gold hover:bg-pos-gold/10 hover:text-pos-gold"
            >
              {t('product.btnCreateAndContinue')}
            </Button>
            <Button type="submit" onClick={form.handleSubmit((data) => handleSubmit(data, true))}>
              {t('product.btnCreate')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
