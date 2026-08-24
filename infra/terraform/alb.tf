# The load balancer, and the rule the single-origin design rests on.
#
# One hostname, so the browser sees one origin: no CORS between the two apps, no
# cross-site cookies. The API owns /api because main.ts sets that as its global
# prefix - the rule routes on a path the application really has, and rewrites
# nothing.
#
# Port 80, no certificate. That is a deliberate choice for a stack destroyed the
# same day, and it is why the API runs with COOKIE_SECURE=false: a browser
# discards a Secure cookie set over plain HTTP, so sign-in would return 200 and
# leave no session. It also means every session here is readable on the wire.

resource "aws_lb" "main" {
  name               = local.name
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = [for subnet in aws_subnet.public : subnet.id]

  enable_deletion_protection = false

  tags = { Name = local.name }
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name}-api"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  # Default is five minutes of draining on every deploy and every destroy.
  # These tasks hold nothing worth draining.
  deregistration_delay = 30

  # Returns 503 when Postgres is unreachable, which is what makes this worth
  # checking rather than a static 200 - see HealthController.
  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name}-web"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  deregistration_delay = 30

  # /login rather than /: the Next proxy 307s an unauthenticated request for /
  # to /login, and a health check follows no redirects. /login renders for a
  # signed-out visitor, which a health check always is.
  health_check {
    path                = "/login"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# Both patterns are needed: /api/* does not match /api itself, which
# AppController serves.
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api", "/api/*"]
    }
  }
}
