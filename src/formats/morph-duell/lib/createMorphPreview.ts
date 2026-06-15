import type { LeagueChampion } from '../data/leagueChampions'

const WIDTH = 1280
const HEIGHT = 720

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Ein Champion-Bild konnte nicht geladen werden.'))
    image.src = source
  })
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
) {
  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height)
  const width = image.width * scale
  const height = image.height * scale
  context.drawImage(
    image,
    (WIDTH - width) / 2,
    (HEIGHT - height) / 2,
    width,
    height,
  )
}

function createLayer(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas wird von diesem Browser nicht unterstützt.')
  drawCover(context, image)
  return canvas
}

export async function createMorphPreview(
  first: LeagueChampion,
  second: LeagueChampion,
) {
  const [firstImage, secondImage] = await Promise.all([
    loadImage(first.splash),
    loadImage(second.splash),
  ])
  const firstLayer = createLayer(firstImage)
  const secondLayer = createLayer(secondImage)
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas wird von diesem Browser nicht unterstützt.')

  context.drawImage(firstLayer, 0, 0)

  const secondContext = secondLayer.getContext('2d')
  if (!secondContext) throw new Error('Canvas wird von diesem Browser nicht unterstützt.')
  secondContext.globalCompositeOperation = 'destination-in'
  const mask = secondContext.createLinearGradient(WIDTH * 0.2, 0, WIDTH * 0.8, 0)
  mask.addColorStop(0, 'rgba(0,0,0,0)')
  mask.addColorStop(0.35, 'rgba(0,0,0,0.18)')
  mask.addColorStop(0.5, 'rgba(0,0,0,0.72)')
  mask.addColorStop(0.65, 'rgba(0,0,0,0.94)')
  mask.addColorStop(1, 'rgba(0,0,0,1)')
  secondContext.fillStyle = mask
  secondContext.fillRect(0, 0, WIDTH, HEIGHT)
  context.drawImage(secondLayer, 0, 0)

  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.16
  context.drawImage(firstLayer, 18, 0, WIDTH, HEIGHT)
  context.globalAlpha = 0.12
  context.drawImage(secondLayer, -18, 0, WIDTH, HEIGHT)
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'

  const vignette = context.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    HEIGHT * 0.12,
    WIDTH / 2,
    HEIGHT / 2,
    WIDTH * 0.68,
  )
  vignette.addColorStop(0, 'rgba(5,3,11,0)')
  vignette.addColorStop(1, 'rgba(5,3,11,0.64)')
  context.fillStyle = vignette
  context.fillRect(0, 0, WIDTH, HEIGHT)

  return canvas.toDataURL('image/png')
}
