(function () {
  const { gridSize, boardSize } = window.SnakeConfig;

  class SnakeRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.tileCount = boardSize / gridSize;
    }

    render(state) {
      this.drawBoard(state.skin);
      this.drawFoods(state.foods);
      this.drawSnake(state.snake, state.direction, state.skin);
      this.drawParticles(state.particles);
    }

    drawBoard(skin) {
      const ctx = this.ctx;
      ctx.fillStyle = "#10171b";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      const gradient = ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
      gradient.addColorStop(0, "rgba(88, 199, 255, 0.08)");
      gradient.addColorStop(0.5, "rgba(132, 240, 106, 0.05)");
      gradient.addColorStop(1, "rgba(255, 209, 102, 0.07)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.strokeStyle = "rgba(195, 214, 224, 0.08)";
      ctx.lineWidth = 1;

      for (let i = 1; i < this.tileCount; i += 1) {
        const position = i * gridSize;
        ctx.beginPath();
        ctx.moveTo(position, 0);
        ctx.lineTo(position, this.canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, position);
        ctx.lineTo(this.canvas.width, position);
        ctx.stroke();
      }

      ctx.strokeStyle = skin.border;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
    }

    drawSnake(snake, direction, skin) {
      snake.forEach((segment, index) => {
        const isHead = index === 0;
        const inset = isHead ? 3 : 4;
        const x = segment.x * gridSize + inset;
        const y = segment.y * gridSize + inset;
        const size = gridSize - inset * 2;
        const bodyRatio = snake.length <= 1 ? 1 : index / (snake.length - 1);

        if (isHead) {
          this.ctx.shadowColor = skin.glow;
          this.ctx.shadowBlur = 15;
        }

        this.ctx.fillStyle = isHead ? skin.head : blendColors(skin.bodyStart, skin.bodyEnd, bodyRatio);
        roundRect(this.ctx, x, y, size, size, isHead ? 8 : 6);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        if (!isHead) {
          this.ctx.fillStyle = skin.detail;
          roundRect(this.ctx, x + 4, y + 4, Math.max(4, size - 8), Math.max(4, size - 8), 4);
          this.ctx.fill();
        }

        if (isHead) {
          this.drawEyes(segment, direction, skin);
        }
      });
    }

    drawEyes(head, direction, skin) {
      const centerX = head.x * gridSize + gridSize / 2;
      const centerY = head.y * gridSize + gridSize / 2;
      const lookingX = direction.x * 4;
      const lookingY = direction.y * 4;
      const eyePairs = direction.x !== 0
        ? [{ x: lookingX, y: -5 }, { x: lookingX, y: 5 }]
        : [{ x: -5, y: lookingY }, { x: 5, y: lookingY }];

      this.ctx.fillStyle = skin.eye;
      eyePairs.forEach((eye) => {
        this.ctx.beginPath();
        this.ctx.arc(centerX + eye.x, centerY + eye.y, 2.5, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }

    drawFoods(foods) {
      foods.forEach((food) => {
        const x = food.x * gridSize + gridSize / 2;
        const y = food.y * gridSize + gridSize / 2;
        const pulse = Math.sin(Date.now() / 170 + food.pulse) * 1.6;
        const radius = food.type === "bonus" ? gridSize * 0.37 + pulse : gridSize * 0.34;

        this.ctx.fillStyle = food.color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = food.type === "bonus" ? "#f4f7f8" : "#ff6b6b";
        this.ctx.beginPath();
        this.ctx.arc(x - 3, y - 4, Math.max(3, radius * 0.36), 0, Math.PI * 2);
        this.ctx.fill();
      });
    }

    drawParticles(particles) {
      particles.forEach((particle) => {
        this.ctx.globalAlpha = Math.max(0, particle.life);
        this.ctx.fillStyle = particle.color;
        this.ctx.beginPath();
        this.ctx.arc(particle.x, particle.y, 3.2, 0, Math.PI * 2);
        this.ctx.fill();
      });
      this.ctx.globalAlpha = 1;
    }
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function blendColors(start, end, ratio) {
    const a = hexToRgb(start);
    const b = hexToRgb(end);
    const r = Math.round(a.r + (b.r - a.r) * ratio);
    const g = Math.round(a.g + (b.g - a.g) * ratio);
    const blue = Math.round(a.b + (b.b - a.b) * ratio);
    return `rgb(${r}, ${g}, ${blue})`;
  }

  function hexToRgb(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  }

  window.SnakeRenderer = SnakeRenderer;
})();
