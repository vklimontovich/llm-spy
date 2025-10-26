'use client'

import { useState, useCallback } from 'react'
import { Card, Button, Input, message, Upload, Typography } from 'antd'
import { MessageCircle, Slack, Send, Paperclip } from 'lucide-react'
import type { UploadFile } from 'antd/es/upload/interface'

const { TextArea } = Input
const { Title, Text, Paragraph } = Typography

interface FeedbackPageProps {
  userEmail: string
  workspaceSlug: string
}

export default function FeedbackPage({
  userEmail,
  workspaceSlug: _workspaceSlug, // eslint-disable-line @typescript-eslint/no-unused-vars
}: FeedbackPageProps) {
  const [feedbackText, setFeedbackText] = useState('')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!feedbackText.trim()) {
      message.warning('Please enter your feedback')
      return
    }

    setIsSubmitting(true)

    try {
      // TODO: Client-side submission logic will be implemented later
      // For now, just show a success message
      console.log('Feedback submitted:', {
        email: userEmail,
        feedback: feedbackText,
        attachments: fileList.map(f => f.name),
      })

      message.success('Thank you for your feedback! We will review it shortly.')
      setFeedbackText('')
      setFileList([])
    } catch (error) {
      message.error('Failed to submit feedback. Please try again.')
      console.error('Feedback submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [feedbackText, fileList, userEmail])

  const handleFileChange = (info: any) => {
    // Keep only the files, don't upload them
    let newFileList = [...info.fileList]

    // Limit to 5 files
    newFileList = newFileList.slice(-5)

    setFileList(newFileList)
  }

  const beforeUpload = () => {
    // Prevent actual upload
    return false
  }

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
          </div>
          <Title level={2}>We&apos;d Love to Hear From You</Title>
          <Paragraph className="text-gray-600 text-lg">
            Get support, ask questions, or share your feedback with us.
          </Paragraph>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Option 1: Slack Channel */}
          <Card
            className="border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
            hoverable
          >
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Slack className="w-6 h-6 text-purple-600" />
              </div>
              <Title level={4} className="mb-2">
                Setup Shared Slack Channel
              </Title>
              <Paragraph className="text-gray-600 mb-4">
                Get a dedicated shared Slack channel with our team for real-time
                support, questions, and collaboration.
              </Paragraph>
              <Button
                type="primary"
                size="large"
                disabled
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                Coming Soon
              </Button>
              <Text className="text-xs text-gray-500 mt-2">
                Direct access to the authors
              </Text>
            </div>
          </Card>

          {/* Option 2: Feedback Form */}
          <Card
            className="border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
            hoverable
          >
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <Title level={4} className="mb-2">
                Send Us Feedback
              </Title>
              <Paragraph className="text-gray-600 mb-4">
                Share your thoughts, suggestions, or report any issues
                you&apos;ve encountered.
              </Paragraph>
              <Button
                type="primary"
                size="large"
                onClick={() => {
                  setShowForm(true)
                  setTimeout(() => {
                    const formSection = document.getElementById('feedback-form')
                    formSection?.scrollIntoView({ behavior: 'smooth' })
                  }, 100)
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                Write Us
              </Button>
            </div>
          </Card>
        </div>

        {/* Feedback Form */}
        {showForm && (
          <>
            <Card
              id="feedback-form"
              className="border border-gray-200 shadow-lg"
            >
              <Title level={3} className="mb-4">
                Your Feedback
              </Title>

              <div className="mb-4">
                <Text className="text-gray-600 mb-2 block">
                  Submitted as: <Text strong>{userEmail}</Text>
                </Text>
              </div>

              <div className="mb-4">
                <TextArea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Tell us what's on your mind... Share your thoughts, report bugs, request features, or ask questions."
                  rows={6}
                  maxLength={5000}
                  showCount
                  className="resize-none"
                />
              </div>

              <div className="mb-4">
                <Upload
                  beforeUpload={beforeUpload}
                  onChange={handleFileChange}
                  fileList={fileList}
                  multiple
                  maxCount={5}
                  listType="picture"
                >
                  <Button icon={<Paperclip className="w-4 h-4" />}>
                    Attach Files (Optional)
                  </Button>
                </Upload>
                <Text className="text-xs text-gray-500 mt-2 block">
                  You can attach up to 5 files (images, screenshots, logs, etc.)
                </Text>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setFeedbackText('')
                    setFileList([])
                  }}
                  disabled={isSubmitting}
                >
                  Clear
                </Button>
                <Button
                  type="primary"
                  icon={<Send className="w-4 h-4" />}
                  onClick={handleSubmit}
                  loading={isSubmitting}
                  disabled={!feedbackText.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600"
                >
                  Submit Feedback
                </Button>
              </div>
            </Card>

            <div className="mt-8 text-center">
              <Text className="text-gray-500 text-sm">
                Thank you for helping us improve! Your feedback is valuable to
                us.
              </Text>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
