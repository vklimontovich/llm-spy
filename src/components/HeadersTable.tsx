'use client'

import { Table, Typography } from 'antd'

const { Text } = Typography

interface HeadersTableProps {
  headers: any
}

export default function HeadersTable({ headers }: HeadersTableProps) {
  if (!headers || typeof headers !== 'object') {
    return <Text>No headers available</Text>
  }

  const headerData = Object.entries(headers).map(([key, value], index) => ({
    key: index,
    name: key,
    value: String(value)
  }))

  const columns = [
    {
      title: 'Header',
      dataIndex: 'name',
      key: 'name',
      width: '30%'
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: '70%'
    }
  ]

  return (
    <Table
      dataSource={headerData}
      columns={columns}
      showHeader={false}
      pagination={false}
      size="small"
      scroll={{ x: true }}
      style={{ fontSize: '10px' }}
      className="text-xs"
    />
  )
}