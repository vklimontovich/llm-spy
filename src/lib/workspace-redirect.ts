import { redirect } from 'next/navigation'
import { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { generateRandomSlug } from '@/lib/slug-generator'

export async function redirectToWorkspace(session: Session | null) {
  // If not logged in, redirect to signin
  if (!session?.user?.email) {
    redirect('/signin')
  }

  // Get user and their workspaces
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      workspaces: {
        include: {
          workspace: true
        }
      }
    }
  })

  if (!user) {
    // User doesn't exist, create them first
    const newUser = await prisma.user.create({
      data: { email: session.user.email }
    })

    // Create a default workspace for the new user
    const slug = generateRandomSlug()
    const workspace = await prisma.workspace.create({
      data: {
        name: 'My Workspace',
        slug: slug,
        users: {
          create: {
            userId: newUser.id,
            role: 'owner'
          }
        }
      }
    })

    redirect(`/${workspace.slug}/upstreams`)
  }

  if (user.workspaces.length === 0) {
    // User exists but has no workspaces, create one
    const slug = generateRandomSlug()
    const workspace = await prisma.workspace.create({
      data: {
        name: 'My Workspace',
        slug: slug,
        users: {
          create: {
            userId: user.id,
            role: 'owner'
          }
        }
      }
    })

    redirect(`/${workspace.slug}/upstreams`)
  }

  // User has workspaces, redirect to the first one
  const firstWorkspace = user.workspaces[0].workspace
  redirect(`/${firstWorkspace.slug}/upstreams`)
}